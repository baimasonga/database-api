/**
 * Generates docs/data-platform/source-inventory-template.xlsx from the CSV
 * template, so field teams can fill it in Excel.
 *   npx tsx scripts/generate-inventory-template.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";

const DOCS = path.resolve("docs/data-platform");

async function main() {
  const csv = await readFile(path.join(DOCS, "source-inventory-template.csv"));
  const rows = parse(csv, { bom: true, columns: false, skip_empty_lines: true }) as string[][];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AVDP Data Platform";
  const sheet = workbook.addWorksheet("Source Inventory");

  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F3ED" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column, index) => {
    const width = Math.max(...rows.map((r) => (r[index] ?? "").length), 12);
    column.width = Math.min(48, width + 2);
  });

  const out = path.join(DOCS, "source-inventory-template.xlsx");
  await writeFile(out, Buffer.from(await workbook.xlsx.writeBuffer()));
  console.log(`Wrote ${out} (${rows.length - 1} example rows).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
