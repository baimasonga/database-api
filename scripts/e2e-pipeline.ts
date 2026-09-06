/**
 * End-to-end pipeline check against the development database:
 * upload → profile → map → validate → submit → approve → publish → analytics.
 * Run with: npx tsx scripts/e2e-pipeline.ts
 */
import { PrismaClient } from "@prisma/client";
import { createImportJob, runValidation } from "../src/modules/ingestion/pipeline";
import { performWorkflowAction } from "../src/modules/approval/service";
import { refreshAnalytics } from "../src/modules/analytics/refresh";
import { getBeneficiarySummary, resolveFilters } from "../src/modules/analytics/queries";
import { PERMISSIONS } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

const CSV = `farmer_name,sex,district_name,chiefdom,value_chain,phone,project_id,cultivated_area
Aminata Kamara,F,BO DISTRICT,Badjia,Rice,+232 76 111222,AVDP-2024-0001,1.5
Mohamed Sesay,M,Kenema,Nongowa,Rice,076111333,AVDP-2024-0002,2.25
Fatmata Bangura,female,Port Loko,Maforki,Cassava,076111444,AVDP-2024-0003,0.75
Ibrahim Koroma,M,Atlantis,Unknown,Rice,076111555,AVDP-2024-0004,-3
Isata Turay,F,Bo,Badjia,Vegetables,076111666,AVDP-2024-0005,1.1
`;

async function main() {
  const [source, dataset, period, admin] = await Promise.all([
    prisma.dataSource.findUniqueOrThrow({ where: { code: "SRC-FARMER-REGISTRY" } }),
    prisma.dataset.findUniqueOrThrow({ where: { code: "DS-FARMER-REGISTRY" } }),
    prisma.reportingPeriod.findFirstOrThrow({ where: { status: "open" }, orderBy: { startDate: "desc" } }),
    prisma.user.findFirstOrThrow({ where: { email: "admin@avdp.local" } }),
  ]);

  const actor = {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    unit: admin.unit,
    roles: ["administrator"],
    permissions: Object.values(PERMISSIONS),
  };

  console.log("1. Uploading and profiling…");
  const importJobId = await createImportJob({
    dataSourceId: source.id,
    datasetId: dataset.id,
    reportingPeriodId: period.id,
    fileName: `e2e-${Date.now()}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
    userId: admin.id,
  });
  const profiled = await prisma.importJob.findUniqueOrThrow({ where: { id: importJobId } });
  console.log(`   rows=${profiled.rowCount} columns=${profiled.columnCount} status=${profiled.status}`);

  console.log("2. Auto-suggested mappings:");
  const mappings = await prisma.importFieldMapping.findMany({ where: { importJobId }, orderBy: { sourceColumn: "asc" } });
  for (const m of mappings) console.log(`   ${m.sourceColumn.padEnd(18)} → ${m.canonicalField ?? "(unmapped)"}`);

  // Columns the heuristic cannot infer are mapped explicitly, as a user would.
  await prisma.importFieldMapping.update({
    where: { importJobId_sourceColumn: { importJobId, sourceColumn: "value_chain" } },
    data: { canonicalField: "value_chain.name", status: "mapped" },
  });
  await prisma.importFieldMapping.update({
    where: { importJobId_sourceColumn: { importJobId, sourceColumn: "chiefdom" } },
    data: { canonicalField: "geography.chiefdom", status: "mapped" },
  });

  console.log("3. Validating…");
  const validation = await runValidation(importJobId);
  console.log(`   status=${validation.status} errors=${validation.errorCount} warnings=${validation.warningCount} valid=${validation.validRows} score=${validation.qualityScore}`);

  const findings = await prisma.validationResult.findMany({ where: { importJobId }, orderBy: { rowNumber: "asc" } });
  for (const f of findings) console.log(`   [${f.severity}] row ${f.rowNumber} ${f.ruleCode}: ${f.message}`);

  console.log("4. Publication must be blocked while errors are unresolved:");
  try {
    await performWorkflowAction(actor, importJobId, "submit", "attempt with open errors");
    console.log("   UNEXPECTED: submission was allowed");
  } catch (error) {
    console.log(`   blocked as expected — ${(error as Error).message}`);
  }

  console.log("5. Resolving the error findings (recording a decision, not rewriting data)…");
  await prisma.validationResult.updateMany({
    where: { importJobId, severity: "error", resolved: false },
    data: { resolved: true, resolution: "record_excluded: rejected at source", resolvedBy: admin.id, resolvedAt: new Date() },
  });
  await prisma.importJob.update({ where: { id: importJobId }, data: { status: "ready_for_review" } });

  console.log("6. Submit → approve → publish…");
  for (const action of ["submit", "approve", "publish"] as const) {
    const outcome = await performWorkflowAction(actor, importJobId, action, `e2e ${action}`);
    console.log(`   ${action}: ${outcome.previousStatus} → ${outcome.newStatus}`);
  }

  console.log("7. Analytics:");
  const refresh = await refreshAnalytics(admin.id, "manual");
  console.log(`   ${refresh.filter((r) => r.status === "succeeded").length}/${refresh.length} views refreshed`);
  const summary = await getBeneficiarySummary(await resolveFilters({}));
  console.log(`   published beneficiaries=${summary.total_beneficiaries} female=${summary.female_count} districts=${summary.districts_covered}`);

  const publication = await prisma.publicationRecord.findFirstOrThrow({ where: { importJobId } });
  console.log(`   publication ${publication.id} rows=${publication.publishedRowCount} status=${publication.status}`);

  const duplicates = await prisma.duplicateCandidate.count({ where: { status: "pending" } });
  console.log(`   potential duplicates awaiting review=${duplicates}`);
  console.log("\nPipeline check complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
