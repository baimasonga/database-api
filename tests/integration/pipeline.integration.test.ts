import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createImportJob, runValidation, DuplicateImportError } from "@/modules/ingestion/pipeline";
import { performWorkflowAction, WorkflowError } from "@/modules/approval/service";
import { getBeneficiarySummary, resolveFilters } from "@/modules/analytics/queries";
import { indicatorLineage } from "@/modules/analytics/lineage";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";

/**
 * End-to-end pipeline integration test (Phase 17).
 *
 * Exercises ingestion, validation, the approval gate, publication, analytics
 * and lineage against a real PostgreSQL database. Skipped automatically when
 * no database is reachable, so unit runs stay hermetic.
 */

const prisma = new PrismaClient();
const SUFFIX = `IT${Date.now().toString(36).toUpperCase()}`;

const CSV = `farmer_name,sex,district_name,value_chain,project_id,cultivated_area
Fatu Sesay,F,Bo,Rice,${SUFFIX}-1,1.5
Alusine Bah,M,Kenema,Rice,${SUFFIX}-2,2.0
Zainab Turay,F,Bombali,Cassava,${SUFFIX}-3,1.1
Broken Row,M,Atlantis,Rice,${SUFFIX}-4,-5
`;

let reachable = false;
let actor: AuthenticatedUser;
let sourceId = "";
let datasetId = "";
let periodId = "";
let importJobId = "";

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    reachable = true;
  } catch {
    return;
  }

  const admin = await prisma.user.findFirst({ where: { email: "admin@avdp.local" } });
  const period = await prisma.reportingPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
  if (!admin || !period) {
    reachable = false;
    return;
  }

  periodId = period.id;
  actor = {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    unit: admin.unit,
    roles: ["administrator"],
    permissions: Object.values(PERMISSIONS),
  };

  const source = await prisma.dataSource.create({
    data: {
      code: `SRC-${SUFFIX}`,
      name: `Integration Test Source ${SUFFIX}`,
      sourceType: "csv",
      connectionType: "upload",
      frequency: "quarterly",
    },
  });
  sourceId = source.id;

  const dataset = await prisma.dataset.create({
    data: { dataSourceId: source.id, code: `DS-${SUFFIX}`, name: `Integration Test Dataset`, domain: "beneficiaries" },
  });
  datasetId = dataset.id;
}, 60_000);

afterAll(async () => {
  if (reachable && sourceId) {
    // Remove only what this test created; publication history is otherwise
    // never deleted, so the cleanup is explicit rather than cascading.
    const jobs = await prisma.importJob.findMany({ where: { dataSourceId: sourceId }, select: { id: true } });
    const jobIds = jobs.map((j) => j.id);
    await prisma.beneficiaryValueChain.deleteMany({ where: { beneficiary: { sourceImportJobId: { in: jobIds } } } });
    await prisma.beneficiaryLocation.deleteMany({ where: { beneficiary: { sourceImportJobId: { in: jobIds } } } });
    await prisma.beneficiaryIdentifier.deleteMany({ where: { beneficiary: { sourceImportJobId: { in: jobIds } } } });
    await prisma.duplicateCandidate.deleteMany({ where: { primary: { sourceImportJobId: { in: jobIds } } } });
    await prisma.beneficiary.deleteMany({ where: { sourceImportJobId: { in: jobIds } } });
    await prisma.publicationRecord.deleteMany({ where: { datasetId } });
    await prisma.datasetVersion.deleteMany({ where: { datasetId } });
    await prisma.approvalAction.deleteMany({ where: { approvalRequest: { importJobId: { in: jobIds } } } });
    await prisma.approvalRequest.deleteMany({ where: { importJobId: { in: jobIds } } });
    await prisma.validationResult.deleteMany({ where: { importJobId: { in: jobIds } } });
    await prisma.importRow.deleteMany({ where: { importJobId: { in: jobIds } } });
    await prisma.importFieldMapping.deleteMany({ where: { importJobId: { in: jobIds } } });
    const files = await prisma.importJob.findMany({ where: { id: { in: jobIds } }, select: { importFileId: true } });
    await prisma.importJob.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.importFile.deleteMany({
      where: { id: { in: files.map((f) => f.importFileId).filter((id): id is string => !!id) } },
    });
    await prisma.dataset.deleteMany({ where: { id: datasetId } });
    await prisma.dataSource.deleteMany({ where: { id: sourceId } });
  }
  await prisma.$disconnect();
}, 60_000);

describe.runIf(process.env.RUN_INTEGRATION_TESTS === "true")("pipeline integration", () => {
  it("ingests a CSV into the raw layer with the file retained", async () => {
    if (!reachable) return;
    importJobId = await createImportJob({
      dataSourceId: sourceId,
      datasetId,
      reportingPeriodId: periodId,
      fileName: `${SUFFIX}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(CSV),
      userId: actor.id,
    });

    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId }, include: { file: true } });
    expect(job.rowCount).toBe(4);
    expect(job.status).toBe("mapping_required");
    expect(job.file?.checksumSha256).toHaveLength(64);

    const rows = await prisma.importRow.count({ where: { importJobId } });
    expect(rows).toBe(4);
  }, 60_000);

  it("rejects a byte-identical re-import of the same file", async () => {
    if (!reachable) return;
    await expect(
      createImportJob({
        dataSourceId: sourceId,
        datasetId,
        reportingPeriodId: periodId,
        fileName: `${SUFFIX}-copy.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(CSV),
        userId: actor.id,
      }),
    ).rejects.toBeInstanceOf(DuplicateImportError);
  }, 60_000);

  it("validates rows and records findings without discarding anything", async () => {
    if (!reachable) return;
    await prisma.importFieldMapping.update({
      where: { importJobId_sourceColumn: { importJobId, sourceColumn: "value_chain" } },
      data: { canonicalField: "value_chain.name", status: "mapped" },
    });

    const outcome = await runValidation(importJobId);
    expect(outcome.status).toBe("validation_failed");
    expect(outcome.validRows).toBe(3);

    // The invalid row is retained with its findings, never dropped.
    expect(await prisma.importRow.count({ where: { importJobId } })).toBe(4);
    const findings = await prisma.validationResult.findMany({ where: { importJobId, severity: "error" } });
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.map((f) => f.ruleCode)).toContain("REF-GEO-DISTRICT");
    expect(findings.map((f) => f.ruleCode)).toContain("RNG-AREA-NON-NEGATIVE");
  }, 120_000);

  it("refuses approval and publication while errors are unresolved", async () => {
    if (!reachable) return;
    await expect(performWorkflowAction(actor, importJobId, "submit", null)).rejects.toBeInstanceOf(WorkflowError);
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    expect(job.status).toBe("validation_failed");
    expect(await prisma.publicationRecord.count({ where: { importJobId } })).toBe(0);
  }, 60_000);

  it("publishes once findings are resolved, materialising only valid rows", async () => {
    if (!reachable) return;
    await prisma.validationResult.updateMany({
      where: { importJobId, severity: "error", resolved: false },
      data: { resolved: true, resolution: "record_excluded", resolvedBy: actor.id, resolvedAt: new Date() },
    });
    await prisma.importJob.update({ where: { id: importJobId }, data: { status: "ready_for_review" } });

    for (const action of ["submit", "approve", "publish"] as const) {
      await performWorkflowAction(actor, importJobId, action, `integration ${action}`);
    }

    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
    expect(job.status).toBe("published");

    // Only the three valid rows reach the core layer.
    const beneficiaries = await prisma.beneficiary.count({ where: { sourceImportJobId: importJobId } });
    expect(beneficiaries).toBe(3);

    const publication = await prisma.publicationRecord.findFirstOrThrow({ where: { importJobId } });
    expect(publication.status).toBe("published");
    expect(publication.publishedRowCount).toBe(3);
  }, 300_000);

  it("surfaces published data in the analytics layer", async () => {
    if (!reachable) return;
    const resolved = await resolveFilters({});
    const summary = await getBeneficiarySummary(resolved);
    expect(summary.total_beneficiaries).toBeGreaterThanOrEqual(3);
    expect(summary.female_count).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("traces the indicator back to this dataset and no other domain", async () => {
    if (!reachable) return;
    const lineage = await indicatorLineage("AVDP-OUT-001", null);
    expect(lineage).not.toBeNull();
    expect(lineage!.domain).toBe("beneficiaries");
    expect(lineage!.publications.map((p) => p.datasetCode)).toContain(`DS-${SUFFIX}`);

    // An infrastructure indicator must not cite this beneficiary dataset.
    const infra = await indicatorLineage("AVDP-OUT-006", null);
    expect(infra!.publications.map((p) => p.datasetCode)).not.toContain(`DS-${SUFFIX}`);
  }, 60_000);

  it("retains publication history when data is unpublished", async () => {
    if (!reachable) return;
    await performWorkflowAction(actor, importJobId, "unpublish", "integration unpublish");
    const publications = await prisma.publicationRecord.findMany({ where: { importJobId } });
    expect(publications).toHaveLength(1);
    expect(publications[0].status).toBe("withdrawn");
    expect(publications[0].withdrawnAt).not.toBeNull();
  }, 120_000);
});
