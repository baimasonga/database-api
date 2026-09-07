import type { ParsedTable } from "@/modules/ingestion/types";

function escapeCsv(value: string | null): string {
  if (value === null) return "";
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Renders a connector's payload as CSV so it can be retained as the import
 * file. Connectors that already collected a real file keep the original bytes
 * instead.
 */
export function toCsvBuffer(table: ParsedTable): Buffer {
  const lines = [table.columns.map(escapeCsv).join(",")];
  for (const row of table.rows) {
    lines.push(table.columns.map((column) => escapeCsv(row[column] ?? null)).join(","));
  }
  return Buffer.from(lines.join("\n"), "utf8");
}
