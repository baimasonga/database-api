import type { MappedRow } from "@/modules/mapping/apply";
import type { ValidationRuleDefinition, ValidationSeverity } from "./rules";

export interface ValidationFinding {
  rowNumber: number;
  fieldName: string | null;
  ruleCode: string;
  category: ValidationRuleDefinition["category"];
  severity: ValidationSeverity;
  message: string;
  rawValue: string | null;
  suggestedValue: string | null;
}

export interface ValidationContext {
  /** Reference sets keyed by name, each holding upper-cased canonical values. */
  referenceSets: Record<string, Set<string>>;
  reportingPeriod?: { code: string; startDate: string; endDate: string };
  /** Row numbers flagged as exact duplicates during profiling. */
  duplicateRowNumbers?: Set<number>;
}

export interface RowInput {
  rowNumber: number;
  raw: Record<string, string | null>;
  mapped: MappedRow;
}

export interface ValidationReport {
  findings: ValidationFinding[];
  totalRows: number;
  validRows: number;
  rowsWithErrors: number;
  rowsWithWarnings: number;
  duplicateRows: number;
  completenessPercent: number;
  duplicateRatePercent: number;
  validationPassRatePercent: number;
  /** Row numbers that carry at least one error-severity finding. */
  errorRowNumbers: Set<number>;
  warningRowNumbers: Set<number>;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function suggestFromReference(value: string, set: Set<string> | undefined): string | null {
  if (!set) return null;
  const upper = value.trim().toUpperCase();
  for (const candidate of set) {
    if (candidate.startsWith(upper) || upper.startsWith(candidate)) return candidate;
  }
  return null;
}

function evaluateRule(
  rule: ValidationRuleDefinition,
  row: RowInput,
  context: ValidationContext,
  uniqueIndex: Map<string, number>,
): ValidationFinding[] {
  const config = rule.config;
  const values = row.mapped.values;
  const findings: ValidationFinding[] = [];

  const push = (message: string, fieldName: string | null, rawValue: string | null, suggested: string | null = null) =>
    findings.push({
      rowNumber: row.rowNumber,
      fieldName,
      ruleCode: rule.code,
      category: rule.category,
      severity: rule.severity,
      message,
      rawValue,
      suggestedValue: suggested,
    });

  switch (config.kind) {
    case "required": {
      if (!(config.field in values)) return findings;
      if (asString(values[config.field]) === null) {
        push(`${rule.name}: value is missing.`, config.field, null);
      }
      break;
    }
    case "type": {
      const value = values[config.field];
      if (value === null || value === undefined) return findings;
      const ok =
        config.expect === "number" || config.expect === "integer"
          ? typeof value === "number" && (config.expect === "number" || Number.isInteger(value))
          : config.expect === "boolean"
            ? typeof value === "boolean"
            : true;
      if (!ok) push(`${rule.name}: expected ${config.expect}.`, config.field, asString(value));
      break;
    }
    case "range": {
      const value = values[config.field];
      if (typeof value !== "number") return findings;
      if (config.min !== undefined && value < config.min) {
        push(`${rule.name}: ${value} is below the minimum of ${config.min}.`, config.field, String(value));
      }
      if (config.max !== undefined && value > config.max) {
        push(`${rule.name}: ${value} is above the maximum of ${config.max}.`, config.field, String(value));
      }
      break;
    }
    case "non_negative": {
      const value = values[config.field];
      if (typeof value === "number" && value < 0) {
        push(`${rule.name}: ${value} is negative.`, config.field, String(value));
      }
      break;
    }
    case "reference": {
      const value = asString(values[config.field]);
      if (value === null) return findings;
      const set = context.referenceSets[config.referenceSet];
      if (!set || set.size === 0) return findings;
      if (!set.has(value.toUpperCase())) {
        push(
          `${rule.name}: "${value}" is not a recognised ${config.referenceSet}.`,
          config.field,
          value,
          suggestFromReference(value, set),
        );
      }
      break;
    }
    case "allowed_values": {
      const value = asString(values[config.field]);
      if (value === null) return findings;
      if (!config.values.map((v) => v.toLowerCase()).includes(value.toLowerCase())) {
        push(`${rule.name}: "${value}" is not one of ${config.values.join(", ")}.`, config.field, value);
      }
      break;
    }
    case "date_window": {
      const value = asString(values[config.field]);
      if (value === null) return findings;
      const time = Date.parse(value);
      if (!Number.isFinite(time)) {
        push(`${rule.name}: "${value}" is not a valid date.`, config.field, value);
        break;
      }
      if (config.notBefore && time < Date.parse(config.notBefore)) {
        push(`${rule.name}: ${value} is before ${config.notBefore}.`, config.field, value);
      }
      if (config.notAfter && time > Date.parse(config.notAfter)) {
        push(`${rule.name}: ${value} is after ${config.notAfter}.`, config.field, value);
      }
      break;
    }
    case "bounding_box": {
      const lat = values[config.latField];
      const lon = values[config.lonField];
      if (typeof lat === "number" && (lat < config.minLat || lat > config.maxLat)) {
        push(`${rule.name}: latitude ${lat} is outside Sierra Leone.`, config.latField, String(lat));
      }
      if (typeof lon === "number" && (lon < config.minLon || lon > config.maxLon)) {
        push(`${rule.name}: longitude ${lon} is outside Sierra Leone.`, config.lonField, String(lon));
      }
      break;
    }
    case "unique": {
      const parts = config.fields.map((f) => asString(values[f])?.toLowerCase() ?? "");
      if (parts.every((p) => p === "")) return findings;
      const key = `${rule.code}::${parts.join("|")}`;
      const firstRow = uniqueIndex.get(key);
      if (firstRow !== undefined) {
        push(`${rule.name}: duplicates row ${firstRow}.`, config.fields[0], parts.join(" / "));
      } else {
        uniqueIndex.set(key, row.rowNumber);
      }
      break;
    }
    case "row_duplicate": {
      if (context.duplicateRowNumbers?.has(row.rowNumber)) {
        push(`${rule.name}.`, null, null);
      }
      break;
    }
    case "period_match": {
      const value = asString(values[config.field]);
      if (value === null || !context.reportingPeriod) return findings;
      const time = Date.parse(value);
      if (!Number.isFinite(time)) return findings;
      const start = Date.parse(context.reportingPeriod.startDate);
      const end = Date.parse(context.reportingPeriod.endDate);
      if (time < start || time > end) {
        push(
          `${rule.name}: ${value} falls outside reporting period ${context.reportingPeriod.code}.`,
          config.field,
          value,
        );
      }
      break;
    }
  }
  return findings;
}

/**
 * Validates every mapped row. Invalid records are never dropped: each finding
 * is returned so it can be persisted against the import job.
 */
export function validateRows(
  rows: RowInput[],
  rules: ValidationRuleDefinition[],
  context: ValidationContext,
): ValidationReport {
  const findings: ValidationFinding[] = [];
  const uniqueIndex = new Map<string, number>();
  const errorRowNumbers = new Set<number>();
  const warningRowNumbers = new Set<number>();

  let filledCells = 0;
  let totalCells = 0;

  for (const row of rows) {
    // Transformation failures are themselves type-category findings.
    for (const error of row.mapped.errors) {
      findings.push({
        rowNumber: row.rowNumber,
        fieldName: error.field,
        ruleCode: "TYP-TRANSFORM",
        category: "type",
        severity: "error",
        message: `Could not convert column "${error.sourceColumn}": ${error.message}`,
        rawValue: error.rawValue,
        suggestedValue: null,
      });
    }

    for (const rule of rules) findings.push(...evaluateRule(rule, row, context, uniqueIndex));

    const mappedKeys = Object.keys(row.mapped.values);
    totalCells += mappedKeys.length;
    filledCells += mappedKeys.filter((k) => asString(row.mapped.values[k]) !== null).length;
  }

  for (const finding of findings) {
    if (finding.severity === "error") errorRowNumbers.add(finding.rowNumber);
    else if (finding.severity === "warning") warningRowNumbers.add(finding.rowNumber);
  }

  const totalRows = rows.length;
  const rowsWithErrors = errorRowNumbers.size;
  const rowsWithWarnings = [...warningRowNumbers].filter((r) => !errorRowNumbers.has(r)).length;
  const validRows = totalRows - rowsWithErrors;
  const duplicateRows = new Set(
    findings.filter((f) => f.category === "duplicate").map((f) => f.rowNumber),
  ).size;

  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100);

  return {
    findings,
    totalRows,
    validRows,
    rowsWithErrors,
    rowsWithWarnings,
    duplicateRows,
    completenessPercent: pct(filledCells, totalCells),
    duplicateRatePercent: pct(duplicateRows, totalRows),
    validationPassRatePercent: pct(validRows, totalRows),
    errorRowNumbers,
    warningRowNumbers,
  };
}

/** Composite 0-100 quality score used in approval screens. */
export function qualityScore(report: ValidationReport): number {
  if (report.totalRows === 0) return 0;
  const score =
    report.validationPassRatePercent * 0.6 +
    report.completenessPercent * 0.3 +
    Math.max(0, 100 - report.duplicateRatePercent) * 0.1;
  return Math.round(score * 100) / 100;
}
