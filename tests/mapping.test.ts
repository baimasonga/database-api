import { describe, expect, it } from "vitest";
import { applyTransformations, defaultTransformationsFor } from "@/modules/mapping/transformations";
import { mapRow, validateMapping, type FieldMapping } from "@/modules/mapping/apply";
import { suggestCanonicalField } from "@/modules/mapping/canonical-fields";

const LOOKUPS = {
  district: { "BO DISTRICT": "Bo", BO: "Bo", KENEMA: "Kenema" },
  sex: { M: "male", F: "female", FEMALE: "female" },
};

describe("declarative transformations", () => {
  it("trims, upper-cases and lower-cases", () => {
    expect(applyTransformations("  bo  ", [{ op: "trim" }]).value).toBe("bo");
    expect(applyTransformations("bo", [{ op: "uppercase" }]).value).toBe("BO");
    expect(applyTransformations("BO", [{ op: "lowercase" }]).value).toBe("bo");
    expect(applyTransformations("aminata kamara", [{ op: "titlecase" }]).value).toBe("Aminata Kamara");
  });

  it("normalises null tokens", () => {
    expect(applyTransformations("N/A", [{ op: "null_normalise" }]).value).toBeNull();
    expect(applyTransformations("Bo", [{ op: "null_normalise" }]).value).toBe("Bo");
  });

  it("parses dates day-first and rejects impossible ones", () => {
    expect(applyTransformations("15/03/2026", [{ op: "parse_date", format: "auto" }]).value).toBe("2026-03-15");
    expect(applyTransformations("2026-03-15", [{ op: "parse_date", format: "auto" }]).value).toBe("2026-03-15");
    expect(applyTransformations("03/15/2026", [{ op: "parse_date", format: "mdy" }]).value).toBe("2026-03-15");
    const bad = applyTransformations("32/13/2026", [{ op: "parse_date", format: "auto" }]);
    expect(bad.value).toBeNull();
    expect(bad.error).toMatch(/not a valid calendar date/);
  });

  it("parses numbers and booleans, reporting failures instead of guessing", () => {
    expect(applyTransformations("1,250.5", [{ op: "parse_number", decimalSeparator: "." }]).value).toBe(1250.5);
    expect(applyTransformations("1.250,5", [{ op: "parse_number", decimalSeparator: "," }]).value).toBe(1250.5);
    expect(applyTransformations("yes", [{ op: "parse_boolean" }]).value).toBe(true);
    expect(applyTransformations("maybe", [{ op: "parse_boolean" }]).error).toMatch(/not a recognised boolean/);
  });

  it("applies controlled lookups", () => {
    expect(applyTransformations("bo district", [{ op: "trim" }, { op: "lookup", set: "district", passthrough: true }], LOOKUPS).value).toBe("Bo");
    expect(applyTransformations("M", [{ op: "lookup", set: "sex", passthrough: true }], LOOKUPS).value).toBe("male");
    // Unknown values pass through so the validation engine reports them.
    expect(applyTransformations("Atlantis", [{ op: "lookup", set: "district", passthrough: true }], LOOKUPS).value).toBe("Atlantis");
    expect(applyTransformations("Atlantis", [{ op: "lookup", set: "district", passthrough: false }], LOOKUPS).error).toMatch(/not a recognised district/);
  });

  it("applies defaults only to empty values", () => {
    expect(applyTransformations(null, [{ op: "default", value: "unknown" }]).value).toBe("unknown");
    expect(applyTransformations("male", [{ op: "default", value: "unknown" }]).value).toBe("male");
  });

  it("chooses sensible default chains per canonical type", () => {
    expect(defaultTransformationsFor("number")).toContainEqual({ op: "parse_number", decimalSeparator: "." });
    expect(defaultTransformationsFor("enum", "sex")).toContainEqual({ op: "lookup", set: "sex", passthrough: true });
  });
});

describe("row mapping", () => {
  const mappings: FieldMapping[] = [
    { sourceColumn: "farmer_name", canonicalField: "beneficiary.full_name", isRequired: true, transformations: [] },
    { sourceColumn: "sex", canonicalField: "beneficiary.sex", isRequired: true, transformations: [] },
    { sourceColumn: "district_name", canonicalField: "geography.district", isRequired: true, transformations: [] },
    { sourceColumn: "area", canonicalField: "production.cultivated_area_ha", isRequired: false, transformations: [] },
    { sourceColumn: "notes", canonicalField: null, isRequired: false, transformations: [] },
  ];

  it("projects a raw row onto canonical fields", () => {
    const mapped = mapRow(
      { farmer_name: " Aminata Kamara ", sex: "F", district_name: "BO DISTRICT", area: "1.5", notes: "ignore me" },
      mappings,
      LOOKUPS,
    );
    expect(mapped.values["beneficiary.full_name"]).toBe("Aminata Kamara");
    expect(mapped.values["beneficiary.sex"]).toBe("female");
    expect(mapped.values["geography.district"]).toBe("Bo");
    expect(mapped.values["production.cultivated_area_ha"]).toBe(1.5);
    expect(mapped.values).not.toHaveProperty("notes");
    expect(mapped.errors).toHaveLength(0);
  });

  it("records conversion failures rather than dropping the row", () => {
    const mapped = mapRow({ farmer_name: "X", sex: "F", district_name: "Bo", area: "not-a-number" }, mappings, LOOKUPS);
    expect(mapped.errors).toHaveLength(1);
    expect(mapped.errors[0].field).toBe("production.cultivated_area_ha");
    expect(mapped.values["beneficiary.full_name"]).toBe("X");
  });
});

describe("mapping validation", () => {
  it("flags missing required fields, duplicates and unknown targets", () => {
    const result = validateMapping(
      [
        { sourceColumn: "a", canonicalField: "beneficiary.full_name", isRequired: true, transformations: [] },
        { sourceColumn: "b", canonicalField: "beneficiary.full_name", isRequired: false, transformations: [] },
        { sourceColumn: "c", canonicalField: "not.a.field", isRequired: false, transformations: [] },
        { sourceColumn: "d", canonicalField: null, isRequired: false, transformations: [] },
      ],
      ["beneficiary.full_name", "geography.district"],
    );
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toEqual(["geography.district"]);
    expect(result.duplicateTargets).toEqual(["beneficiary.full_name"]);
    expect(result.unknownFields).toEqual(["not.a.field"]);
    expect(result.unmappedColumns).toEqual(["d"]);
  });
});

describe("column suggestions", () => {
  it("suggests canonical fields from common spreadsheet headers", () => {
    expect(suggestCanonicalField("farmer_name")).toBe("beneficiary.full_name");
    expect(suggestCanonicalField("Gender")).toBe("beneficiary.sex");
    expect(suggestCanonicalField("district_name")).toBe("geography.district");
    expect(suggestCanonicalField("totally unrelated")).toBeNull();
  });
});
