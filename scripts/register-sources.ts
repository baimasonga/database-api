/**
 * Bulk registration of known data sources from the inventory CSV (Phase 14).
 * Registers metadata only — it never uploads, validates or publishes data, and
 * everything it creates starts at onboarding status `discovered`.
 *
 *   npx tsx scripts/register-sources.ts <inventory.csv> [--commit]
 *
 * Without --commit the script reports what it would create and changes nothing.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import {
  InventoryRowError,
  planFromInventoryRow,
  type InventoryRow,
} from "../src/modules/governance/inventory";

const prisma = new PrismaClient();

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("Usage: npx tsx scripts/register-sources.ts <inventory.csv> [--commit]");
  const commit = flags.includes("--commit");

  const rows = parse(await readFile(file), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as InventoryRow[];

  console.log(`${rows.length} inventory row(s)${commit ? "" : " — dry run, nothing will be written"}\n`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    let plan;
    try {
      plan = planFromInventoryRow(row);
    } catch (error) {
      console.log(`  skipped: ${error instanceof InventoryRowError ? error.message : String(error)}`);
      skipped += 1;
      continue;
    }

    const existing = await prisma.dataSource.findUnique({ where: { code: plan.source.code } });
    if (existing) {
      console.log(`  exists:  ${plan.source.code}  ${plan.source.name}`);
      skipped += 1;
      continue;
    }

    const { sourceType, connectionType, frequency, containsPersonalData } = plan.source;
    console.log(
      `  create:  ${plan.source.code}  ${plan.source.name}  ` +
        `[${sourceType}/${connectionType}/${frequency}${containsPersonalData ? ", personal data" : ""}]` +
        `  → dataset ${plan.dataset.code} (${plan.dataset.domain})`,
    );
    created += 1;
    if (!commit) continue;

    const source = await prisma.dataSource.create({
      data: { ...plan.source, status: "active", onboardingStatus: "discovered" },
    });
    await prisma.dataset.create({
      data: { ...plan.dataset, dataSourceId: source.id, onboardingStatus: "discovered" },
    });
  }

  console.log(`\n${created} source(s) ${commit ? "registered" : "would be registered"}, ${skipped} skipped.`);
  if (!commit && created > 0) console.log("Re-run with --commit to write.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
