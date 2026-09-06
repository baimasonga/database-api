import { createHash } from "node:crypto";
import type { ColumnProfile, ParsedTable, TableProfile } from "./types";

const SAMPLE_LIMIT = 5;
const DISTINCT_LIMIT = 10_000;

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}([T ].*)?$/,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,
];
const BOOLEAN_VALUES = new Set(["true", "false", "yes", "no", "y", "n", "1", "0"]);

function detectType(values: string[]): ColumnProfile["detectedType"] {
  if (values.length === 0) return "empty";
  const isBoolean = values.every((v) => BOOLEAN_VALUES.has(v.trim().toLowerCase()));
  if (isBoolean && values.some((v) => !/^[01]$/.test(v.trim()))) return "boolean";
  const numeric = values.every((v) => v.trim() !== "" && Number.isFinite(Number(v.replace(/,/g, ""))));
  if (numeric) {
    const allInts = values.every((v) => Number.isInteger(Number(v.replace(/,/g, ""))));
    return allInts ? "integer" : "number";
  }
  if (values.every((v) => DATE_PATTERNS.some((p) => p.test(v.trim())))) return "date";
  if (isBoolean) return "boolean";
  return "string";
}

/** Hash of the whole row, used for duplicate detection and idempotent imports. */
export function hashRow(row: Record<string, unknown>): string {
  const normalised = Object.keys(row)
    .sort()
    .map((k) => `${k}=${String(row[k] ?? "").trim().toLowerCase()}`)
    .join("|");
  return createHash("sha256").update(normalised).digest("hex");
}

/**
 * Profiles a parsed table without modifying any source value — profiling is
 * strictly read-only, as required by the ingestion rules.
 */
export function profileTable(table: ParsedTable): TableProfile {
  const columns: ColumnProfile[] = table.columns.map((name) => {
    const present: string[] = [];
    const distinct = new Set<string>();
    let nullCount = 0;
    for (const row of table.rows) {
      const value = row[name];
      if (value === null || value === undefined || String(value).trim() === "") {
        nullCount += 1;
        continue;
      }
      const text = String(value);
      present.push(text);
      if (distinct.size < DISTINCT_LIMIT) distinct.add(text.trim().toLowerCase());
    }
    const filledCount = present.length;
    return {
      name,
      detectedType: detectType(present.slice(0, 1000)),
      nullCount,
      filledCount,
      distinctCount: distinct.size,
      completenessPercent:
        table.rows.length === 0 ? 0 : Math.round((filledCount / table.rows.length) * 10000) / 100,
      sampleValues: [...new Set(present)].slice(0, SAMPLE_LIMIT),
    };
  });

  const seen = new Map<string, number>();
  const duplicateRowNumbers: number[] = [];
  table.rows.forEach((row, index) => {
    const hash = hashRow(row);
    if (seen.has(hash)) duplicateRowNumbers.push(index + 1);
    else seen.set(hash, index + 1);
  });

  return {
    rowCount: table.rows.length,
    columnCount: table.columns.length,
    columns,
    duplicateRowCount: duplicateRowNumbers.length,
    duplicateRowNumbers: duplicateRowNumbers.slice(0, 500),
    profiledAt: new Date().toISOString(),
  };
}
