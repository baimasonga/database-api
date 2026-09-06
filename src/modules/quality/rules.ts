import { z } from "zod";

export type ValidationCategory =
  | "required_field"
  | "type"
  | "range"
  | "reference"
  | "duplicate"
  | "geography"
  | "date"
  | "business_rule"
  | "consistency";

export type ValidationSeverity = "error" | "warning" | "info";

/** Declarative rule configuration — never executable code. */
export const ruleConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("required"), field: z.string() }),
  z.object({ kind: z.literal("type"), field: z.string(), expect: z.enum(["string", "number", "integer", "date", "boolean"]) }),
  z.object({ kind: z.literal("range"), field: z.string(), min: z.number().optional(), max: z.number().optional() }),
  z.object({ kind: z.literal("reference"), field: z.string(), referenceSet: z.string() }),
  z.object({ kind: z.literal("allowed_values"), field: z.string(), values: z.array(z.string()) }),
  z.object({ kind: z.literal("date_window"), field: z.string(), notBefore: z.string().optional(), notAfter: z.string().optional() }),
  z.object({ kind: z.literal("bounding_box"), latField: z.string(), lonField: z.string(), minLat: z.number(), maxLat: z.number(), minLon: z.number(), maxLon: z.number() }),
  z.object({ kind: z.literal("unique"), fields: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("row_duplicate") }),
  z.object({ kind: z.literal("period_match"), field: z.string() }),
  z.object({ kind: z.literal("non_negative"), field: z.string() }),
]);

export type RuleConfig = z.infer<typeof ruleConfigSchema>;

export interface ValidationRuleDefinition {
  code: string;
  name: string;
  description?: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  fieldName?: string;
  config: RuleConfig;
}

/** Sierra Leone bounding box, used by the geography rules. */
export const SIERRA_LEONE_BBOX = { minLat: 6.85, maxLat: 10.05, minLon: -13.35, maxLon: -10.25 };

/**
 * Baseline rules applied to every dataset unless a dataset-specific rule set
 * overrides them.
 */
export const BASELINE_RULES: ValidationRuleDefinition[] = [
  {
    code: "REQ-BEN-NAME",
    name: "Beneficiary name is required",
    category: "required_field",
    severity: "error",
    fieldName: "beneficiary.full_name",
    config: { kind: "required", field: "beneficiary.full_name" },
  },
  {
    code: "REQ-GEO-DISTRICT",
    name: "District is required",
    category: "required_field",
    severity: "error",
    fieldName: "geography.district",
    config: { kind: "required", field: "geography.district" },
  },
  {
    code: "REF-GEO-DISTRICT",
    name: "District must exist in AVDP master data",
    category: "reference",
    severity: "error",
    fieldName: "geography.district",
    config: { kind: "reference", field: "geography.district", referenceSet: "district" },
  },
  {
    code: "REF-GEO-CHIEFDOM",
    name: "Chiefdom must exist in AVDP master data",
    category: "reference",
    severity: "warning",
    fieldName: "geography.chiefdom",
    config: { kind: "reference", field: "geography.chiefdom", referenceSet: "chiefdom" },
  },
  {
    code: "REF-VALUE-CHAIN",
    name: "Value chain must be a registered AVDP value chain",
    category: "reference",
    severity: "error",
    fieldName: "value_chain.name",
    config: { kind: "reference", field: "value_chain.name", referenceSet: "value_chain" },
  },
  {
    code: "TYP-BEN-SEX",
    name: "Sex must be a recognised value",
    category: "type",
    severity: "error",
    fieldName: "beneficiary.sex",
    config: { kind: "allowed_values", field: "beneficiary.sex", values: ["male", "female", "other", "unknown"] },
  },
  {
    code: "DAT-BEN-DOB",
    name: "Date of birth must be a plausible date",
    category: "date",
    severity: "warning",
    fieldName: "beneficiary.date_of_birth",
    config: { kind: "date_window", field: "beneficiary.date_of_birth", notBefore: "1900-01-01" },
  },
  {
    code: "GEO-BBOX",
    name: "Coordinates must fall inside Sierra Leone",
    category: "geography",
    severity: "error",
    config: {
      kind: "bounding_box",
      latField: "geography.latitude",
      lonField: "geography.longitude",
      ...SIERRA_LEONE_BBOX,
    },
  },
  {
    code: "RNG-AREA-NON-NEGATIVE",
    name: "Cultivated area must not be negative",
    category: "range",
    severity: "error",
    fieldName: "production.cultivated_area_ha",
    config: { kind: "non_negative", field: "production.cultivated_area_ha" },
  },
  {
    code: "RNG-QTY-NON-NEGATIVE",
    name: "Production quantity must not be negative",
    category: "range",
    severity: "error",
    fieldName: "production.quantity",
    config: { kind: "non_negative", field: "production.quantity" },
  },
  {
    code: "DUP-ROW",
    name: "Row duplicates another row in the same file",
    category: "duplicate",
    severity: "warning",
    config: { kind: "row_duplicate" },
  },
  {
    code: "DUP-BEN-IDENTITY",
    name: "Beneficiary appears more than once in this file",
    category: "duplicate",
    severity: "warning",
    config: { kind: "unique", fields: ["beneficiary.full_name", "beneficiary.phone"] },
  },
  {
    code: "CON-PERIOD-MATCH",
    name: "Record date falls inside the selected reporting period",
    category: "consistency",
    severity: "warning",
    fieldName: "production.harvest_date",
    config: { kind: "period_match", field: "production.harvest_date" },
  },
];
