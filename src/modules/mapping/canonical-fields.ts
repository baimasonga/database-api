/**
 * The AVDP canonical field catalogue. External columns are mapped onto these
 * names; the ingestion pipeline knows how to persist each target entity.
 */
export type CanonicalDataType = "string" | "number" | "integer" | "date" | "boolean" | "enum";

export interface CanonicalField {
  key: string;
  label: string;
  entity: string;
  type: CanonicalDataType;
  required: boolean;
  /** Lookup set applied automatically when no explicit transformation is set. */
  lookupSet?: string;
  enumValues?: string[];
  description?: string;
}

export const CANONICAL_FIELDS: CanonicalField[] = [
  // Beneficiary identity
  { key: "beneficiary.full_name", label: "Full name", entity: "beneficiary", type: "string", required: true },
  { key: "beneficiary.first_name", label: "First name", entity: "beneficiary", type: "string", required: false },
  { key: "beneficiary.last_name", label: "Last name", entity: "beneficiary", type: "string", required: false },
  { key: "beneficiary.sex", label: "Sex", entity: "beneficiary", type: "enum", required: true, lookupSet: "sex", enumValues: ["male", "female", "other", "unknown"] },
  { key: "beneficiary.date_of_birth", label: "Date of birth", entity: "beneficiary", type: "date", required: false },
  { key: "beneficiary.age_group", label: "Age group", entity: "beneficiary", type: "string", required: false },
  { key: "beneficiary.phone", label: "Phone number", entity: "beneficiary", type: "string", required: false },
  { key: "beneficiary.beneficiary_type", label: "Beneficiary type", entity: "beneficiary", type: "string", required: false },
  { key: "beneficiary.is_youth", label: "Youth", entity: "beneficiary", type: "boolean", required: false },
  { key: "beneficiary.disability", label: "Disability", entity: "beneficiary", type: "boolean", required: false },
  { key: "beneficiary.national_id", label: "National ID / NIN", entity: "beneficiary_identifier", type: "string", required: false },
  { key: "beneficiary.project_id", label: "Existing project beneficiary number", entity: "beneficiary_identifier", type: "string", required: false },
  { key: "beneficiary.external_source_id", label: "External source ID", entity: "beneficiary_identifier", type: "string", required: false },
  { key: "beneficiary.group_membership_id", label: "Group membership ID", entity: "beneficiary_identifier", type: "string", required: false },

  // Geography
  { key: "geography.district", label: "District", entity: "geography", type: "string", required: true, lookupSet: "district" },
  { key: "geography.chiefdom", label: "Chiefdom", entity: "geography", type: "string", required: false, lookupSet: "chiefdom" },
  { key: "geography.ward", label: "Ward", entity: "geography", type: "string", required: false },
  { key: "geography.community", label: "Community", entity: "geography", type: "string", required: false },
  { key: "geography.latitude", label: "Latitude", entity: "geography", type: "number", required: false },
  { key: "geography.longitude", label: "Longitude", entity: "geography", type: "number", required: false },

  // Value chain and groups
  { key: "value_chain.name", label: "Value chain", entity: "value_chain", type: "string", required: false, lookupSet: "value_chain" },
  { key: "farmer_group.name", label: "Farmer group", entity: "farmer_group", type: "string", required: false },

  // Training
  { key: "training.title", label: "Training title", entity: "training", type: "string", required: false },
  { key: "training.type", label: "Training type", entity: "training", type: "string", required: false },
  { key: "training.start_date", label: "Training start date", entity: "training", type: "date", required: false },
  { key: "training.end_date", label: "Training end date", entity: "training", type: "date", required: false },
  { key: "training.duration_days", label: "Training duration (days)", entity: "training", type: "number", required: false },
  { key: "training.attended", label: "Attended", entity: "training", type: "boolean", required: false },
  { key: "training.certified", label: "Certified", entity: "training", type: "boolean", required: false },

  // Production
  { key: "production.season", label: "Season", entity: "production", type: "string", required: false },
  { key: "production.cultivated_area_ha", label: "Cultivated area (ha)", entity: "production", type: "number", required: false },
  { key: "production.quantity", label: "Production quantity", entity: "production", type: "number", required: false },
  { key: "production.unit", label: "Unit of measure", entity: "production", type: "string", required: false, lookupSet: "unit" },
  { key: "production.harvest_date", label: "Harvest date", entity: "production", type: "date", required: false },

  // Infrastructure
  { key: "infrastructure.name", label: "Asset name", entity: "infrastructure", type: "string", required: false },
  { key: "infrastructure.asset_type", label: "Asset type", entity: "infrastructure", type: "string", required: false },
  { key: "infrastructure.status", label: "Asset status", entity: "infrastructure", type: "string", required: false },
  { key: "infrastructure.quantity", label: "Asset quantity", entity: "infrastructure", type: "number", required: false },
  { key: "infrastructure.completion_percent", label: "Completion %", entity: "infrastructure", type: "number", required: false },
  { key: "infrastructure.beneficiaries_served", label: "Beneficiaries served", entity: "infrastructure", type: "integer", required: false },
];

export const CANONICAL_FIELD_MAP = new Map(CANONICAL_FIELDS.map((f) => [f.key, f]));

export function fieldsForDomain(domain: string): CanonicalField[] {
  switch (domain) {
    case "beneficiaries":
      return CANONICAL_FIELDS.filter((f) =>
        ["beneficiary", "beneficiary_identifier", "geography", "value_chain", "farmer_group"].includes(f.entity),
      );
    case "training":
      return CANONICAL_FIELDS.filter((f) =>
        ["beneficiary", "beneficiary_identifier", "geography", "value_chain", "training"].includes(f.entity),
      );
    case "production":
      return CANONICAL_FIELDS.filter((f) =>
        ["beneficiary", "beneficiary_identifier", "geography", "value_chain", "production"].includes(f.entity),
      );
    case "infrastructure":
      return CANONICAL_FIELDS.filter((f) => ["geography", "value_chain", "infrastructure"].includes(f.entity));
    default:
      return CANONICAL_FIELDS;
  }
}

/** Heuristic column-name suggestions offered in the mapping UI. */
const SUGGESTIONS: Array<[RegExp, string]> = [
  [/^(farmer|beneficiary|participant)?[_ ]?(full)?[_ ]?name$/i, "beneficiary.full_name"],
  [/^(first|given)[_ ]?name$/i, "beneficiary.first_name"],
  [/^(last|sur|family)[_ ]?name$/i, "beneficiary.last_name"],
  [/^(sex|gender)$/i, "beneficiary.sex"],
  [/^(dob|date[_ ]?of[_ ]?birth|birth[_ ]?date)$/i, "beneficiary.date_of_birth"],
  [/^(phone|mobile|tel|telephone|contact[_ ]?number)$/i, "beneficiary.phone"],
  [/^(nin|national[_ ]?id|nid)$/i, "beneficiary.national_id"],
  [/^(project[_ ]?id|beneficiary[_ ]?(no|number|id))$/i, "beneficiary.project_id"],
  [/^(external[_ ]?id|source[_ ]?id|uuid|_id)$/i, "beneficiary.external_source_id"],
  [/^(district|district[_ ]?name)$/i, "geography.district"],
  [/^(chiefdom|chiefdom[_ ]?name)$/i, "geography.chiefdom"],
  [/^ward([_ ]?name)?$/i, "geography.ward"],
  [/^(community|village|town|settlement)$/i, "geography.community"],
  [/^(lat|latitude|gps[_ ]?lat)$/i, "geography.latitude"],
  [/^(lon|lng|long|longitude|gps[_ ]?lon)$/i, "geography.longitude"],
  [/^(value[_ ]?chain|crop|commodity)$/i, "value_chain.name"],
  [/^(group|farmer[_ ]?group|fbo|cooperative)$/i, "farmer_group.name"],
  [/^(area|cultivated[_ ]?area|hectares|ha)$/i, "production.cultivated_area_ha"],
  [/^(quantity|qty|output|production|yield)$/i, "production.quantity"],
  [/^(unit|uom|unit[_ ]?of[_ ]?measure)$/i, "production.unit"],
  [/^(harvest[_ ]?date)$/i, "production.harvest_date"],
  [/^(training[_ ]?title|course|topic)$/i, "training.title"],
  [/^(attended|attendance)$/i, "training.attended"],
  [/^(asset[_ ]?type|infrastructure[_ ]?type)$/i, "infrastructure.asset_type"],
];

export function suggestCanonicalField(column: string): string | null {
  const trimmed = column.trim();
  for (const [pattern, target] of SUGGESTIONS) {
    if (pattern.test(trimmed)) return target;
  }
  return null;
}
