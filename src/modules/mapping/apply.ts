import { CANONICAL_FIELD_MAP } from "./canonical-fields";
import {
  applyTransformations,
  defaultTransformationsFor,
  transformationsSchema,
  type LookupTables,
  type Transformation,
} from "./transformations";

export interface FieldMapping {
  sourceColumn: string;
  canonicalField: string | null;
  isRequired: boolean;
  transformations: unknown;
}

export interface MappedRow {
  values: Record<string, string | number | boolean | null>;
  errors: Array<{ field: string; sourceColumn: string; message: string; rawValue: string | null }>;
}

function resolveTransformations(mapping: FieldMapping): Transformation[] {
  const parsed = transformationsSchema.safeParse(mapping.transformations ?? []);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  const field = mapping.canonicalField ? CANONICAL_FIELD_MAP.get(mapping.canonicalField) : undefined;
  return field ? defaultTransformationsFor(field.type, field.lookupSet) : [{ op: "trim" }, { op: "null_normalise" }];
}

/** Projects one raw source row onto the canonical model. */
export function mapRow(
  raw: Record<string, string | null>,
  mappings: FieldMapping[],
  lookups: LookupTables = {},
): MappedRow {
  const values: Record<string, string | number | boolean | null> = {};
  const errors: MappedRow["errors"] = [];

  for (const mapping of mappings) {
    if (!mapping.canonicalField) continue;
    const rawValue = raw[mapping.sourceColumn] ?? null;
    const outcome = applyTransformations(rawValue, resolveTransformations(mapping), lookups);
    if (outcome.error) {
      errors.push({
        field: mapping.canonicalField,
        sourceColumn: mapping.sourceColumn,
        message: outcome.error,
        rawValue,
      });
      values[mapping.canonicalField] = null;
      continue;
    }
    values[mapping.canonicalField] = outcome.value;
  }
  return { values, errors };
}

export interface MappingValidation {
  valid: boolean;
  missingRequired: string[];
  unmappedColumns: string[];
  duplicateTargets: string[];
  unknownFields: string[];
}

/** Pre-import mapping check surfaced in the Data Mapping screen. */
export function validateMapping(mappings: FieldMapping[], requiredFields: string[]): MappingValidation {
  const mappedTargets = mappings.map((m) => m.canonicalField).filter((f): f is string => !!f);
  const seen = new Set<string>();
  const duplicateTargets = new Set<string>();
  for (const target of mappedTargets) {
    if (seen.has(target)) duplicateTargets.add(target);
    seen.add(target);
  }
  const missingRequired = requiredFields.filter((f) => !seen.has(f));
  const unknownFields = [...seen].filter((f) => !CANONICAL_FIELD_MAP.has(f));
  const unmappedColumns = mappings.filter((m) => !m.canonicalField).map((m) => m.sourceColumn);

  return {
    valid: missingRequired.length === 0 && duplicateTargets.size === 0 && unknownFields.length === 0,
    missingRequired,
    unmappedColumns,
    duplicateTargets: [...duplicateTargets],
    unknownFields,
  };
}
