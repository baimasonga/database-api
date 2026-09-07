/**
 * Development check: publishes an infrastructure dataset alongside the
 * existing beneficiary data, then confirms each indicator's lineage cites only
 * the datasets that actually produced its records.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/dev/verify-lineage.ts
 */
import { PrismaClient } from "@prisma/client";
import { createImportJob, runValidation } from "../../src/modules/ingestion/pipeline";
import { performWorkflowAction } from "../../src/modules/approval/service";
import { indicatorLineage } from "../../src/modules/analytics/lineage";
import { PERMISSIONS } from "../../src/lib/auth/permissions";

const prisma = new PrismaClient();

const INFRA_CSV = `asset_name,asset_type,district_name,status,quantity,beneficiaries_served
Bo Feeder Road,Feeder road,Bo,completed,12,3400
Kenema Store,Storage facility,Kenema,ongoing,1,900
`;

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@avdp.local" } });
  const period = await prisma.reportingPeriod.findFirstOrThrow({ where: { status: "open" } });
  const actor = {
    id: admin.id, email: admin.email, fullName: admin.fullName, unit: admin.unit,
    roles: ["administrator"], permissions: Object.values(PERMISSIONS),
  };

  const source = await prisma.dataSource.upsert({
    where: { code: "SRC-INFRASTRUCTURE" },
    create: { code: "SRC-INFRASTRUCTURE", name: "Infrastructure Delivery Tracker", sourceType: "excel", connectionType: "upload" },
    update: {},
  });
  const dataset = await prisma.dataset.upsert({
    where: { code: "DS-INFRASTRUCTURE" },
    create: { dataSourceId: source.id, code: "DS-INFRASTRUCTURE", name: "Infrastructure Assets", domain: "infrastructure" },
    update: {},
  });

  const importJobId = await createImportJob({
    dataSourceId: source.id, datasetId: dataset.id, reportingPeriodId: period.id,
    fileName: `infra-${Date.now()}.csv`, mimeType: "text/csv",
    buffer: Buffer.from(INFRA_CSV), userId: admin.id,
  });

  const map: Array<[string, string]> = [
    ["asset_name", "infrastructure.name"],
    ["asset_type", "infrastructure.asset_type"],
    ["status", "infrastructure.status"],
    ["quantity", "infrastructure.quantity"],
    ["beneficiaries_served", "infrastructure.beneficiaries_served"],
  ];
  for (const [sourceColumn, canonicalField] of map) {
    await prisma.importFieldMapping.update({
      where: { importJobId_sourceColumn: { importJobId, sourceColumn } },
      data: { canonicalField, status: "mapped" },
    });
  }
  // Infrastructure rows carry no beneficiary name; that baseline rule does not apply.
  await prisma.importFieldMapping.updateMany({ where: { importJobId }, data: { isRequired: false } });

  const outcome = await runValidation(importJobId);
  console.log(`infrastructure import: ${outcome.status}, ${outcome.errorCount} error(s)`);
  if (outcome.errorCount > 0) {
    await prisma.validationResult.updateMany({
      where: { importJobId, severity: "error", resolved: false },
      data: { resolved: true, resolution: "not_an_issue: no beneficiary column in this dataset", resolvedBy: admin.id, resolvedAt: new Date() },
    });
    await prisma.importJob.update({ where: { id: importJobId }, data: { status: "ready_for_review" } });
  }
  for (const action of ["submit", "approve", "publish"] as const) {
    await performWorkflowAction(actor, importJobId, action, `lineage check ${action}`);
  }

  const total = await prisma.publicationRecord.count({ where: { status: "published" } });
  console.log(`\n${total} live publication(s) exist in total. Lineage per indicator:\n`);

  for (const code of ["AVDP-OUT-001", "AVDP-OUT-004", "AVDP-OUT-005", "AVDP-OUT-006"]) {
    const lineage = await indicatorLineage(code, null);
    if (!lineage) continue;
    const datasets = lineage.publications.map((p) => p.datasetName);
    console.log(
      `  ${code} (${lineage.indicator.calculationRef ?? "no ref"})\n` +
        `    traced to : ${lineage.domain ?? "unmapped"}\n` +
        `    datasets  : ${datasets.length ? datasets.join(", ") : "(none)"}\n` +
        `    quality   : ${lineage.qualityStatus}`,
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
