/**
 * Development check: walks one dataset through the ingestion lifecycle and
 * prints its onboarding status after each stage.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/dev/verify-onboarding.ts
 */
import { PrismaClient } from "@prisma/client";
import { createImportJob, runValidation } from "../../src/modules/ingestion/pipeline";
import { performWorkflowAction } from "../../src/modules/approval/service";
import { PERMISSIONS } from "../../src/lib/auth/permissions";

const prisma = new PrismaClient();

const CSV = `farmer_name,sex,district_name,value_chain,project_id
Kadiatu Mansaray,F,Bo,Rice,AVDP-ONB-0001
Alpha Turay,M,Kenema,Cassava,AVDP-ONB-0002
`;

async function status(datasetId: string, label: string) {
  const d = await prisma.dataset.findUniqueOrThrow({
    where: { id: datasetId },
    select: { onboardingStatus: true, dataSource: { select: { onboardingStatus: true } } },
  });
  console.log(`  ${label.padEnd(26)} dataset=${d.onboardingStatus.padEnd(11)} source=${d.dataSource.onboardingStatus}`);
}

async function main() {
  const source = await prisma.dataSource.upsert({
    where: { code: "SRC-ONBOARDING-CHECK" },
    create: {
      code: "SRC-ONBOARDING-CHECK", name: "Onboarding Check Source", sourceType: "csv",
      connectionType: "upload", frequency: "quarterly", onboardingStatus: "discovered",
    },
    update: { onboardingStatus: "discovered" },
  });
  const dataset = await prisma.dataset.upsert({
    where: { code: "DS-ONBOARDING-CHECK" },
    create: {
      dataSourceId: source.id, code: "DS-ONBOARDING-CHECK", name: "Onboarding Check",
      domain: "beneficiaries", onboardingStatus: "discovered",
    },
    update: { onboardingStatus: "discovered" },
  });
  const period = await prisma.reportingPeriod.findFirstOrThrow({ where: { status: "open" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@avdp.local" } });
  const actor = {
    id: admin.id, email: admin.email, fullName: admin.fullName, unit: admin.unit,
    roles: ["administrator"], permissions: Object.values(PERMISSIONS),
  };

  await status(dataset.id, "registered");

  const importJobId = await createImportJob({
    dataSourceId: source.id, datasetId: dataset.id, reportingPeriodId: period.id,
    fileName: `onboarding-${Date.now()}.csv`, mimeType: "text/csv",
    buffer: Buffer.from(CSV), userId: admin.id,
  });
  await status(dataset.id, "uploaded + profiled");

  await prisma.importFieldMapping.update({
    where: { importJobId_sourceColumn: { importJobId, sourceColumn: "value_chain" } },
    data: { canonicalField: "value_chain.name", status: "mapped" },
  });
  const outcome = await runValidation(importJobId);
  await status(dataset.id, `validated (${outcome.status})`);

  for (const action of ["submit", "approve"] as const) {
    await performWorkflowAction(actor, importJobId, action, `onboarding check ${action}`);
    await status(dataset.id, action);
  }

  await performWorkflowAction(actor, importJobId, "publish", "onboarding check publish");
  await status(dataset.id, "published");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
