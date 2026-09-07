import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { createImportJob, DuplicateImportError, runValidation } from "@/modules/ingestion/pipeline";
import { UploadRejected } from "@/modules/ingestion/storage";
import { decryptSecret } from "./secrets";
import { getConnector, isImplemented, type ConnectorContext, type ConnectorType } from "./registry";
import { registerBuiltInConnectors } from "./index";
import { toCsvBuffer } from "./serialise";

/**
 * Integration run orchestration (Phase 16).
 *
 * A connector run lands in exactly the same pipeline as a manual upload:
 *
 *   Connector → Raw Import → Mapping → Validation → Approval → Publication
 *
 * The orchestrator stops after validation, by construction. It has no code
 * path to approve or publish, so an integration cannot bypass the governance
 * controls no matter how it is configured or scheduled.
 */

export class IntegrationRunError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
    this.name = "IntegrationRunError";
  }
}

export interface RunOutcome {
  integrationRunId: string;
  status: "succeeded" | "failed" | "no_data";
  importJobId?: string;
  recordsReceived: number;
  recordsProcessed: number;
  recordsRejected: number;
  /** Import status after validation — never "approved" or "published". */
  importStatus?: string;
  message: string;
}

async function contextFor(integrationId: string, reportingPeriodCode: string): Promise<ConnectorContext> {
  const integration = await prisma.integration.findUniqueOrThrow({ where: { id: integrationId } });
  return {
    config: (integration.config ?? {}) as Record<string, unknown>,
    secret: integration.secretCiphertext ? decryptSecret(integration.secretCiphertext) : undefined,
    reportingPeriodCode,
  };
}

/** Verifies a connector's configuration and reachability without ingesting. */
export async function testConnection(
  integrationId: string,
): Promise<{ ok: boolean; message: string }> {
  registerBuiltInConnectors();
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) throw new IntegrationRunError("Integration not found.", 404);

  const connector = getConnector(integration.connectorType as ConnectorType);
  if (!connector) {
    return {
      ok: false,
      message: `No adapter is registered for the ${integration.connectorType.replace(/_/g, " ")} connector yet.`,
    };
  }

  const period = await prisma.reportingPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
  let result: { ok: boolean; message: string };
  try {
    result = await connector.testConnection(await contextFor(integrationId, period?.code ?? ""));
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Connection test failed." };
  }

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastAttemptAt: new Date(),
      ...(result.ok
        ? { failureMessage: null }
        : { lastFailureAt: new Date(), failureMessage: result.message.slice(0, 500) }),
    },
  });
  return result;
}

export interface RunInput {
  integrationId: string;
  datasetId: string;
  reportingPeriodId: string;
  actor: AuthenticatedUser;
  request?: Request;
}

/**
 * Executes one integration run end to end, recording the attempt whatever the
 * outcome so a failing connector is visible rather than silent.
 */
export async function runIntegration(input: RunInput): Promise<RunOutcome> {
  registerBuiltInConnectors();

  const integration = await prisma.integration.findUnique({
    where: { id: input.integrationId },
    include: { dataSource: { select: { id: true, name: true } } },
  });
  if (!integration) throw new IntegrationRunError("Integration not found.", 404);
  if (integration.status === "paused") throw new IntegrationRunError("This integration is paused.");
  if (!isImplemented(integration.connectorType as ConnectorType)) {
    throw new IntegrationRunError(
      `The ${integration.connectorType.replace(/_/g, " ")} connector is framework-only; no adapter is registered yet.`,
    );
  }

  const connector = getConnector(integration.connectorType as ConnectorType);
  if (!connector) throw new IntegrationRunError("No adapter is registered for this connector type.");

  const [dataset, period] = await Promise.all([
    prisma.dataset.findUnique({ where: { id: input.datasetId } }),
    prisma.reportingPeriod.findUnique({ where: { id: input.reportingPeriodId } }),
  ]);
  if (!dataset || dataset.dataSourceId !== integration.dataSourceId) {
    throw new IntegrationRunError("The selected dataset does not belong to this integration's data source.");
  }
  if (!period) throw new IntegrationRunError("Unknown reporting period.");
  if (period.status === "locked") throw new IntegrationRunError(`Reporting period ${period.code} is locked.`);

  const run = await prisma.integrationRun.create({
    data: { integrationId: integration.id, status: "running", triggeredBy: input.actor.id },
  });
  await prisma.integration.update({ where: { id: integration.id }, data: { lastAttemptAt: new Date() } });

  const fail = async (message: string, received = 0): Promise<RunOutcome> => {
    await prisma.integrationRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        recordsReceived: received,
        errorSummary: message.slice(0, 1000),
      },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "failing", lastFailureAt: new Date(), failureMessage: message.slice(0, 500) },
    });
    await recordAudit(
      input.actor,
      { action: "integration.run_failed", entityType: "integration", entityId: integration.id, summary: message },
      input.request,
    );
    return {
      integrationRunId: run.id,
      status: "failed",
      recordsReceived: received,
      recordsProcessed: 0,
      recordsRejected: received,
      message,
    };
  };

  let fetched;
  try {
    fetched = await connector.fetch(await contextFor(integration.id, period.code));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "The connector could not fetch data.");
  }

  if (fetched.table.rows.length === 0) {
    await prisma.integrationRun.update({
      where: { id: run.id },
      data: { status: "succeeded", completedAt: new Date(), recordsReceived: 0 },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "active", lastSuccessAt: new Date(), failureMessage: null },
    });
    return {
      integrationRunId: run.id,
      status: "no_data",
      recordsReceived: 0,
      recordsProcessed: 0,
      recordsRejected: 0,
      message: "The connector returned no records; nothing was imported.",
    };
  }

  // The connector's payload is retained verbatim as the import file, so a
  // connector-sourced figure is as traceable as an uploaded one.
  const fileName =
    fetched.sourceFileName ?? `${integration.code}-${period.code}-${new Date().toISOString().slice(0, 10)}.csv`;
  const buffer = fetched.sourceBuffer ?? toCsvBuffer(fetched.table);

  let importJobId: string;
  try {
    importJobId = await createImportJob({
      dataSourceId: integration.dataSourceId,
      datasetId: dataset.id,
      reportingPeriodId: period.id,
      fileName,
      mimeType: fileName.endsWith(".csv") ? "text/csv" : "application/octet-stream",
      buffer,
      userId: input.actor.id,
    });
  } catch (error) {
    if (error instanceof DuplicateImportError) {
      const message = "The connector returned data identical to an existing import for this period.";
      await prisma.integrationRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          completedAt: new Date(),
          recordsReceived: fetched.recordsReceived,
          recordsRejected: fetched.recordsReceived,
          errorSummary: message,
        },
      });
      await prisma.integration.update({
        where: { id: integration.id },
        data: { status: "active", lastSuccessAt: new Date(), failureMessage: null },
      });
      return {
        integrationRunId: run.id,
        status: "no_data",
        recordsReceived: fetched.recordsReceived,
        recordsProcessed: 0,
        recordsRejected: fetched.recordsReceived,
        message,
      };
    }
    if (error instanceof UploadRejected) return fail(error.message, fetched.recordsReceived);
    return fail(error instanceof Error ? error.message : "The import could not be created.", fetched.recordsReceived);
  }

  await prisma.importJob.update({ where: { id: importJobId }, data: { integrationRunId: run.id } });

  // Validation runs exactly as it does for a manual upload. The result is
  // recorded, never acted on: approval and publication remain human decisions.
  const validation = await runValidation(importJobId);
  const rejected = Math.max(0, fetched.recordsReceived - validation.validRows);

  await prisma.integrationRun.update({
    where: { id: run.id },
    data: {
      status: "succeeded",
      completedAt: new Date(),
      recordsReceived: fetched.recordsReceived,
      recordsProcessed: validation.validRows,
      recordsRejected: rejected,
      errorSummary:
        validation.errorCount > 0 ? `${validation.errorCount} validation error(s) require review.` : null,
    },
  });
  await prisma.integration.update({
    where: { id: integration.id },
    data: { status: "active", lastSuccessAt: new Date(), failureMessage: null },
  });
  await prisma.dataSource.update({
    where: { id: integration.dataSourceId },
    data: { lastSuccessfulSyncAt: new Date() },
  });

  await recordAudit(
    input.actor,
    {
      action: "integration.run",
      entityType: "integration",
      entityId: integration.id,
      summary: `${fetched.recordsReceived} record(s) received → import ${importJobId} (${validation.status})`,
    },
    input.request,
  );

  return {
    integrationRunId: run.id,
    status: "succeeded",
    importJobId,
    recordsReceived: fetched.recordsReceived,
    recordsProcessed: validation.validRows,
    recordsRejected: rejected,
    importStatus: validation.status,
    message:
      validation.status === "ready_for_review"
        ? `${validation.validRows} record(s) imported and validated. Awaiting review and approval.`
        : `Imported with ${validation.errorCount} validation error(s). Resolve them before the data can be approved.`,
  };
}
