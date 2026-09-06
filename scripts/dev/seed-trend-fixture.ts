/**
 * Development helper: lands a second import in an earlier reporting period so
 * the Data Manager quality trend has more than one point to render.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/dev/seed-trend-fixture.ts
 */
import { PrismaClient } from "@prisma/client";
import { createImportJob, runValidation } from "../../src/modules/ingestion/pipeline";

const prisma = new PrismaClient();

const CSV = `farmer_name,sex,district_name,value_chain,project_id,cultivated_area
Hawa Conteh,F,Bo,Rice,AVDP-2025-0001,1.2
Sorie Kargbo,M,Kenema,Rice,AVDP-2025-0002,2.0
Adama Jalloh,F,Bombali,Cassava,AVDP-2025-0003,0.9
Santigie Bah,M,Atlantis,Rice,AVDP-2025-0004,1.0
`;

async function main() {
  const [source, dataset, admin, period] = await Promise.all([
    prisma.dataSource.findUniqueOrThrow({ where: { code: "SRC-FARMER-REGISTRY" } }),
    prisma.dataset.findUniqueOrThrow({ where: { code: "DS-FARMER-REGISTRY" } }),
    prisma.user.findFirstOrThrow({ where: { email: "admin@avdp.local" } }),
    prisma.reportingPeriod.findFirstOrThrow({ where: { code: "2026-Q1" } }),
  ]);

  const importJobId = await createImportJob({
    dataSourceId: source.id,
    datasetId: dataset.id,
    reportingPeriodId: period.id,
    fileName: `trend-${Date.now()}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
    userId: admin.id,
  });

  await prisma.importFieldMapping.update({
    where: { importJobId_sourceColumn: { importJobId, sourceColumn: "value_chain" } },
    data: { canonicalField: "value_chain.name", status: "mapped" },
  });

  const outcome = await runValidation(importJobId);
  console.log(`${period.code}: ${outcome.status} — ${outcome.validRows} valid, ${outcome.errorCount} error(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
