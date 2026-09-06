/**
 * Repository inventory mapping (Phase 14).
 *
 * Turns a row of the AVDP source-inventory template into the metadata needed to
 * register a data source and its dataset. Registration is metadata only — this
 * module never touches the data the inventory describes.
 */

export const INVENTORY_COLUMNS = [
  "Source Name",
  "Owning Unit",
  "Repository Location",
  "File Name",
  "File Type",
  "Description",
  "Reporting Period",
  "Geographic Coverage",
  "Value Chain",
  "Approximate Rows",
  "Primary Identifier",
  "Frequency",
  "Contains Beneficiary Data",
  "Contains Personal Data",
  "Integration Method",
  "Known Quality Issues",
  "Status",
  "Notes",
] as const;

export type InventoryRow = Record<string, string | undefined>;

export type SourceType =
  | "excel" | "csv" | "database" | "api" | "odk" | "kobo" | "manual" | "gis" | "other";
export type ConnectionType = "upload" | "api" | "database" | "scheduled" | "manual";
export type UpdateFrequency =
  | "ad_hoc" | "daily" | "weekly" | "monthly" | "quarterly" | "semi_annual" | "annual";
export type DatasetDomain =
  | "beneficiaries" | "training" | "production" | "infrastructure" | "inputs" | "geography" | "indicators" | "other";

const SOURCE_TYPE_BY_FILE: Record<string, SourceType> = {
  XLSX: "excel", XLS: "excel", XLSM: "excel", EXCEL: "excel",
  CSV: "csv", TSV: "csv", TXT: "csv",
  ODK: "odk", KOBO: "kobo",
  API: "api", JSON: "api",
  DB: "database", DATABASE: "database", SQL: "database",
  GIS: "gis", SHP: "gis", GEOJSON: "gis",
};

const CONNECTION_BY_METHOD: Record<string, ConnectionType> = {
  UPLOAD: "upload", API: "api", DATABASE: "database", SCHEDULED: "scheduled", MANUAL: "manual",
};

const FREQUENCIES: Record<string, UpdateFrequency> = {
  DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", QUARTERLY: "quarterly",
  "SEMI-ANNUAL": "semi_annual", "SEMI ANNUAL": "semi_annual", SEMIANNUAL: "semi_annual",
  ANNUAL: "annual", YEARLY: "annual",
  "AD HOC": "ad_hoc", "AD-HOC": "ad_hoc", ADHOC: "ad_hoc",
};

export function isYes(value: string | undefined): boolean {
  return ["YES", "Y", "TRUE", "1"].includes((value ?? "").trim().toUpperCase());
}

/** `SRC-AVDP-FARMER-REGISTRY` from `AVDP Farmer Registry`. */
export function inventoryCode(value: string, prefix: string): string {
  const body = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${prefix}-${body}`;
}

export function sourceTypeFor(fileType: string | undefined): SourceType {
  return SOURCE_TYPE_BY_FILE[(fileType ?? "").trim().toUpperCase()] ?? "other";
}

export function connectionTypeFor(method: string | undefined): ConnectionType {
  return CONNECTION_BY_METHOD[(method ?? "").trim().toUpperCase()] ?? "upload";
}

export function frequencyFor(frequency: string | undefined): UpdateFrequency {
  return FREQUENCIES[(frequency ?? "").trim().toUpperCase()] ?? "ad_hoc";
}

/** Infers the canonical domain from the row's description and name. */
export function domainFor(row: InventoryRow): DatasetDomain {
  const text = `${row["Description"] ?? ""} ${row["Source Name"] ?? ""} ${row["File Name"] ?? ""}`.toLowerCase();
  if (/\btraining|attendance|capacity building\b/.test(text)) return "training";
  if (/\binfrastructure|civil works|asset|road|irrigation\b/.test(text)) return "infrastructure";
  if (/\bproduction|harvest|yield|output\b/.test(text)) return "production";
  if (/\binput|seed|fertili[sz]er|distribution\b/.test(text)) return "inputs";
  if (isYes(row["Contains Beneficiary Data"])) return "beneficiaries";
  return "other";
}

export interface InventoryPlan {
  source: {
    code: string;
    name: string;
    description: string | null;
    ownerUnit: string | null;
    sourceType: SourceType;
    connectionType: ConnectionType;
    frequency: UpdateFrequency;
    dataClassification: "internal" | "confidential";
    containsPersonalData: boolean;
    repositoryLocation: string | null;
    notes: string | null;
  };
  dataset: {
    code: string;
    name: string;
    description: string | null;
    domain: DatasetDomain;
    ownerUnit: string | null;
    primaryIdentifier: string | null;
    frequency: UpdateFrequency;
  };
}

export class InventoryRowError extends Error {}

/**
 * Maps one inventory row to a registration plan. Everything registered starts
 * at `discovered`: the inventory records that a dataset exists, never that it
 * has been assessed.
 */
export function planFromInventoryRow(row: InventoryRow): InventoryPlan {
  const name = (row["Source Name"] ?? "").trim();
  if (!name) throw new InventoryRowError("Row has no Source Name.");

  const personal = isYes(row["Contains Personal Data"]);
  const frequency = frequencyFor(row["Frequency"]);
  const ownerUnit = (row["Owning Unit"] ?? "").trim() || null;
  const description = (row["Description"] ?? "").trim() || null;
  const notes = [row["Known Quality Issues"], row["Notes"]]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" | ");

  return {
    source: {
      code: inventoryCode(name, "SRC"),
      name,
      description,
      ownerUnit,
      sourceType: sourceTypeFor(row["File Type"]),
      connectionType: connectionTypeFor(row["Integration Method"]),
      frequency,
      // Personal data is confidential by default; classification can be raised
      // afterwards, never silently lowered here.
      dataClassification: personal ? "confidential" : "internal",
      containsPersonalData: personal,
      repositoryLocation: (row["Repository Location"] ?? "").trim() || null,
      notes: notes || null,
    },
    dataset: {
      code: inventoryCode(name, "DS"),
      name: (row["File Name"] ?? "").trim() || name,
      description,
      domain: domainFor(row),
      ownerUnit,
      primaryIdentifier: (row["Primary Identifier"] ?? "").trim() || null,
      frequency,
    },
  };
}
