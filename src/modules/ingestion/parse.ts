import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import type { ParsedTable } from "./types";

const MAX_ROWS = 200_000;

function normaliseHeader(raw: unknown, index: number): string {
  const value = String(raw ?? "").trim();
  return value.length > 0 ? value : `column_${index + 1}`;
}

/** Ensures headers are unique so a row object never loses a column. */
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });
}

export function parseCsvBuffer(buffer: Buffer): ParsedTable {
  const records = parseCsv(buffer, {
    bom: true,
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  }) as string[][];

  if (records.length === 0) return { columns: [], rows: [] };

  const columns = dedupeHeaders(records[0].map(normaliseHeader));
  const rows = records.slice(1, MAX_ROWS + 1).map((record) => {
    const row: Record<string, string | null> = {};
    columns.forEach((col, i) => {
      const value = record[i];
      row[col] = value === undefined || value === "" ? null : String(value);
    });
    return row;
  });
  return { columns, rows };
}

function cellToString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return value.result === null || value.result === undefined ? null : String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
    return null;
  }
  const text = String(value);
  return text === "" ? null : text;
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { columns: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const rawHeaders: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    rawHeaders[colNumber - 1] = normaliseHeader(cellToString(cell.value), colNumber - 1);
  });
  const columns = dedupeHeaders(
    rawHeaders.map((h, i) => h ?? `column_${i + 1}`).filter((_, i) => i < sheet.columnCount),
  );

  const rows: Array<Record<string, string | null>> = [];
  for (let r = 2; r <= Math.min(sheet.rowCount, MAX_ROWS + 1); r += 1) {
    const row = sheet.getRow(r);
    const record: Record<string, string | null> = {};
    let hasValue = false;
    columns.forEach((col, i) => {
      const value = cellToString(row.getCell(i + 1).value);
      record[col] = value;
      if (value !== null) hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  return { columns, rows };
}

export async function parseTable(buffer: Buffer, extension: string): Promise<ParsedTable> {
  const ext = extension.toLowerCase().replace(/^\./, "");
  if (ext === "csv" || ext === "txt" || ext === "tsv") return parseCsvBuffer(buffer);
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") return parseXlsxBuffer(buffer);
  throw new Error(`Unsupported file type: .${ext}`);
}
