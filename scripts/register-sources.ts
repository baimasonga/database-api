/**
 * Bulk registration of known data sources from the inventory CSV (Phase 14).
 * Registers metadata only — it never uploads, validates or publishes data.
 *
 *   npx tsx scripts/register-sources.ts <inventory.csv> [--commit]
 *
 * Without --commit the script reports what it would create and changes nothing.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

type Row = Record<string, string>;

const SOURCE_TYPE_BY_FILE: Record<string, string> = {
  XLSX: "excel", XLS: "excel", CSV: "csv", ODK: "odk", KOBO: "kobo",
  API: "api", DB: "database", DATABASE: "database", GIS: "gis",
};

const FREQUENCIES: Record<string, string> = {
  DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", QUARTERLY: "quarterly",
  "SEMI-ANNUAL": "semi_annual", ANNUAL: "annual", "AD HOC": "ad_hoc",
};

const CONNECTION_BY_METHOD: Record<string, string> = {
  UPLOAD: "upload", API: "api", DATABASE: "database", SCHEDULED: "scheduled", MANUAL: "manual",
};

function slug(value: string, prefix: string): string {
  const body = value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${prefix}-${body}`;
}

function domainFor(row: Row): string {
  const text = `${row["Description"] ?? ""} ${row["Source Name"] ?? ""}`.toLowerCase();
  if (text.includes("training") || text.includes("attendance")) return "training";
  if (text.includes("infrastructure") || text.includes("works") || text.includes("asset")) return "infrastructure";
  if (text.includes("production") || text.includes("harvest") || text.includes("yield")) return "production";
  if (row["Contains Beneficiary Data"]?.toUpperCase() === "YES") return "beneficiaries";
  return "other";
}

const yes = (value: string | undefined) => (value ?? "").trim().toUpperCase() === "YES";

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("Usage: npx tsx scripts/register-sources.ts <inventory.csv> [--commit]");
  const commit = flags.includes("--commit");

  const rows = parse(await readFile(file), { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Row[];
  console.log(`${rows.length} inventory row(s)${commit ? "" : " — dry run, nothing will be written"}\n`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = row["Source Name"];
    if (!name) {
      console.log("  skipped: row has no Source Name");
      skipped += 1;
      continue;
    }

    const sourceCode = slug(name, "SRC");
    const sourceType = SOURCE_TYPE_BY_FILE[(row["File Type"] ?? "").toUpperCase()] ?? "other";
    const connectionType = CONNECTION_BY_METHOD[(row["Integration Method"] ?? "").toUpperCase()] ?? "upload";
    const frequency = FREQUENCIES[(row["Frequency"] ?? "").toUpperCase()] ?? "ad_hoc";
    const personal = yes(row["Contains Personal Data"]);

    const existing = await prisma.dataSource.findUnique({ where: { code: sourceCode } });
    if (existing) {
      console.log(`  exists:  ${sourceCode}  ${name}`);
      skipped += 1;
      continue;
    }

    console.log(`  create:  ${sourceCode}  ${name}  [${sourceType}/${connectionType}/${frequency}${personal ? ", personal data" : ""}]`);
    created += 1;
    if (!commit) continue;

    const source = await prisma.dataSource.create({
      data: {
        code: sourceCode,
        name,
        description: row["Description"] || null,
        ownerUnit: row["Owning Unit"] || null,
        sourceType: sourceType as never,
        connectionType: connectionType as never,
        frequency: frequency as never,
        status: "active",
        dataClassification: personal ? "confidential" : "internal",
        containsPersonalData: personal,
        repositoryLocation: row["Repository Location"] || null,
        notes: [row["Known Quality Issues"], row["Notes"]].filter(Boolean).join(" | ") || null,
        onboardingStatus: "discovered",
      },
    });

    await prisma.dataset.create({
      data: {
        dataSourceId: source.id,
        code: slug(name, "DS"),
        name: row["File Name"] || name,
        description: row["Description"] || null,
        domain: domainFor(row) as never,
        ownerUnit: row["Owning Unit"] || null,
        primaryIdentifier: row["Primary Identifier"] || null,
        frequency: frequency as never,
        onboardingStatus: "discovered",
      },
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
