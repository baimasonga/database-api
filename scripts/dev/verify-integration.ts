/**
 * Development check: runs a file connector end to end and confirms the data
 * lands in the raw layer, is validated, and stops short of publication.
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/dev/verify-integration.ts
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { runIntegration, testConnection } from "../../src/modules/integrations/runner";
import { encryptSecret } from "../../src/modules/integrations/secrets";
import { PERMISSIONS } from "../../src/lib/auth/permissions";

const prisma = new PrismaClient();

const CSV = `farmer_name,sex,district_name,value_chain,project_id
Isatu Bangura,F,Bo,Rice,AVDP-INT-0001
Foday Kamara,M,Kenema,Cassava,AVDP-INT-0002
Mariama Koroma,F,Bombali,Rice,AVDP-INT-0003
`;

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "avdp-watch-"));
  await writeFile(path.join(dir, "registry-drop.csv"), CSV);
  console.log(`watched directory: ${dir}\n`);

  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@avdp.local" } });
  const period = await prisma.reportingPeriod.findFirstOrThrow({ where: { status: "open" } });
  const source = await prisma.dataSource.findUniqueOrThrow({ where: { code: "SRC-FARMER-REGISTRY" } });
  const dataset = await prisma.dataset.findUniqueOrThrow({ where: { code: "DS-FARMER-REGISTRY" } });
  const actor = {
    id: admin.id, email: admin.email, fullName: admin.fullName, unit: admin.unit,
    roles: ["administrator"], permissions: Object.values(PERMISSIONS),
  };

  const integration = await prisma.integration.upsert({
    where: { code: "INT-FILE-DROP" },
    create: {
      dataSourceId: source.id, code: "INT-FILE-DROP", name: "Farmer Registry File Drop",
      connectorType: "scheduled_file", status: "active", scheduleCron: "0 2 * * *",
      config: { directory: dir, extensions: ["csv"] },
      secretCiphertext: encryptSecret({ note: "no credentials needed for a file drop" }),
    },
    update: { config: { directory: dir, extensions: ["csv"] }, status: "active" },
  });

  const test = await testConnection(integration.id);
  console.log(`Test connection: ${test.ok ? "OK" : "FAILED"} — ${test.message}\n`);

  const outcome = await runIntegration({
    integrationId: integration.id, datasetId: dataset.id,
    reportingPeriodId: period.id, actor,
  });
  console.log("Run outcome:");
  console.log(`  status           : ${outcome.status}`);
  console.log(`  records received : ${outcome.recordsReceived}`);
  console.log(`  records processed: ${outcome.recordsProcessed}`);
  console.log(`  records rejected : ${outcome.recordsRejected}`);
  console.log(`  import status    : ${outcome.importStatus}`);
  console.log(`  message          : ${outcome.message}\n`);

  if (outcome.importJobId) {
    const job = await prisma.importJob.findUniqueOrThrow({
      where: { id: outcome.importJobId },
      include: { file: true, publications: true, integrationRun: true },
    });
    console.log("Governance checks:");
    console.log(`  import status is not published/approved : ${!["published", "approved"].includes(job.status)} (${job.status})`);
    console.log(`  no publication record created           : ${job.publications.length === 0}`);
    console.log(`  original payload retained               : ${job.file?.fileName} (${job.file?.sizeBytes} bytes, sha256 ${job.file?.checksumSha256.slice(0, 12)}…)`);
    console.log(`  traceable to the integration run        : ${job.integrationRunId === outcome.integrationRunId}`);
  }

  console.log("\nRe-running the same unchanged file (idempotency):");
  const second = await runIntegration({
    integrationId: integration.id, datasetId: dataset.id,
    reportingPeriodId: period.id, actor,
  });
  console.log(`  status: ${second.status} — ${second.message}`);

  const stored = await prisma.integration.findUniqueOrThrow({ where: { id: integration.id } });
  console.log(`\nSecret stored as ciphertext: ${stored.secretCiphertext?.slice(0, 24)}…`);
  console.log(`Plaintext absent from stored value: ${!stored.secretCiphertext?.includes("no credentials")}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
