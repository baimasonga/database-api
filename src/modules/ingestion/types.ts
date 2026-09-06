export interface ParsedTable {
  columns: string[];
  rows: Array<Record<string, string | null>>;
}

export interface ColumnProfile {
  name: string;
  detectedType: "string" | "number" | "integer" | "date" | "boolean" | "empty";
  nullCount: number;
  filledCount: number;
  distinctCount: number;
  completenessPercent: number;
  sampleValues: string[];
}

export interface TableProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  duplicateRowCount: number;
  duplicateRowNumbers: number[];
  profiledAt: string;
}
