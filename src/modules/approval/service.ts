import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { canTransition, type ImportStatus, type WorkflowAction } from "./workflow";
import { materialiseImport } from "./materialise";
import { refreshAnalytics } from "@/modules/analytics/refresh";

export class WorkflowError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "WorkflowError";
  }
}

export interface TransitionOutcome {
  importJobId: string;
  previousStatus: ImportStatus;
  newStatus: ImportStatus;
  publicationRecordId?: string;
}

/**
 * Executes one approval-workflow action, writing the approval request, the
 * action history, the publication record and the audit trail atomically.
 */
export async function performWorkflowAction(
  actor: AuthenticatedUser,
  importJobId: string,
  action: WorkflowAction,
  comment: string | null,
  request?: Request,
): Promise<TransitionOutcome> {
  const job = await prisma.importJob.findUnique({
    where: { id: importJobId },
    include: { dataset: true },
  });
  if (!job) throw new WorkflowError("Import job not found.", 404);

  const unresolvedErrors = await prisma.validationResult.count({
    where: { importJobId, severity: "error", resolved: false },
  });

  const check = canTransition({
    action,
    currentStatus: job.status as ImportStatus,
    permissions: actor.permissions,
    unresolvedErrorCount: unresolvedErrors,
  });
  if (!check.allowed || !check.nextStatus) {
    throw new WorkflowError(check.reason ?? "Transition not allowed.", check.reason?.includes("permission") ? 403 : 409);
  }

  const previousStatus = job.status as ImportStatus;
  const newStatus = check.nextStatus;

  const outcome = await prisma.$transaction(
    async (tx) => {
      let approvalRequest = await tx.approvalRequest.findFirst({
        where: { importJobId, status: { notIn: ["withdrawn", "rejected"] } },
        orderBy: { createdAt: "desc" },
      });

      if (action === "submit") {
        const warnings = await tx.validationResult.count({ where: { importJobId, severity: "warning", resolved: false } });
        approvalRequest = await tx.approvalRequest.create({
          data: {
            importJobId,
            status: "pending",
            submittedBy: actor.id,
            qualityScore: job.qualityScore,
            errorCount: unresolvedErrors,
            warningCount: warnings,
            comment,
          },
        });
      } else if (!approvalRequest) {
        throw new WorkflowError("No open approval request for this import.", 409);
      } else {
        const statusByAction: Partial<Record<WorkflowAction, "pending" | "in_review" | "returned" | "approved" | "rejected" | "withdrawn">> = {
          start_review: "in_review",
          return_for_correction: "returned",
          approve: "approved",
          reject: "rejected",
          withdraw: "withdrawn",
        };
        const nextRequestStatus = statusByAction[action];
        if (nextRequestStatus) {
          approvalRequest = await tx.approvalRequest.update({
            where: { id: approvalRequest.id },
            data: {
              status: nextRequestStatus,
              decidedAt: ["approved", "rejected"].includes(nextRequestStatus) ? new Date() : null,
              comment: comment ?? approvalRequest.comment,
            },
          });
        }
      }

      await tx.approvalAction.create({
        data: {
          approvalRequestId: approvalRequest.id,
          action,
          actorId: actor.id,
          previousStatus,
          newStatus,
          comment,
        },
      });

      let publicationRecordId: string | undefined;

      if (action === "publish") {
        const result = await materialiseImport(tx, importJobId, actor.id);

        // Retain publication history: the previous live publication for this
        // dataset + period is superseded, never deleted.
        const superseded = await tx.publicationRecord.findMany({
          where: { datasetId: job.datasetId, reportingPeriodId: job.reportingPeriodId, status: "published" },
        });

        const publication = await tx.publicationRecord.create({
          data: {
            datasetId: job.datasetId,
            importJobId,
            reportingPeriodId: job.reportingPeriodId,
            status: "published",
            publishedRowCount: result.recordsWritten,
            qualityScore: job.qualityScore,
            publishedBy: actor.id,
            notes: comment,
          },
        });
        publicationRecordId = publication.id;

        if (superseded.length > 0) {
          await tx.publicationRecord.updateMany({
            where: { id: { in: superseded.map((p) => p.id) } },
            data: { status: "superseded", supersededAt: new Date(), supersededById: publication.id },
          });
        }

        const version = await tx.datasetVersion.aggregate({
          where: { datasetId: job.datasetId },
          _max: { versionNumber: true },
        });
        await tx.datasetVersion.create({
          data: {
            datasetId: job.datasetId,
            reportingPeriodId: job.reportingPeriodId,
            versionNumber: (version._max.versionNumber ?? 0) + 1,
            rowCount: result.recordsWritten,
            createdBy: actor.id,
          },
        });

        await tx.dataSource.update({
          where: { id: job.dataSourceId },
          data: { lastSuccessfulImportAt: new Date(), onboardingStatus: "live" },
        });
      }

      if (action === "unpublish") {
        await tx.publicationRecord.updateMany({
          where: { importJobId, status: "published" },
          data: { status: "withdrawn", withdrawnAt: new Date() },
        });
      }

      await tx.importJob.update({
        where: { id: importJobId },
        data: { status: newStatus, updatedBy: actor.id, statusMessage: comment },
      });

      return { publicationRecordId };
    },
    { timeout: 120_000, maxWait: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  await recordAudit(
    actor,
    {
      action: `import.${action}`,
      entityType: "import_job",
      entityId: importJobId,
      summary: `${previousStatus} → ${newStatus}`,
      changes: { previousStatus, newStatus, comment },
    },
    request,
  );

  // Analytics views read published data directly, so publication only needs to
  // record the refresh; materialised views would be refreshed here instead.
  if (action === "publish" || action === "unpublish") {
    await refreshAnalytics(actor.id, "publication");
  }

  return { importJobId, previousStatus, newStatus, publicationRecordId: outcome.publicationRecordId };
}
