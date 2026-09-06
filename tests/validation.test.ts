import { describe, expect, it } from "vitest";
import { validateRows, qualityScore, type RowInput } from "@/modules/quality/engine";
import { BASELINE_RULES } from "@/modules/quality/rules";

const CONTEXT = {
  referenceSets: {
    district: new Set(["BO", "KENEMA", "PORT LOKO"]),
    chiefdom: new Set(["BADJIA"]),
    value_chain: new Set(["RICE", "CASSAVA"]),
  },
  reportingPeriod: { code: "2026-Q2", startDate: "2026-04-01", endDate: "2026-06-30" },
  duplicateRowNumbers: new Set([3]),
};

function row(rowNumber: number, values: Record<string, string | number | boolean | null>): RowInput {
  return { rowNumber, raw: {}, mapped: { values, errors: [] } };
}

describe("validation engine", () => {
  it("accepts a clean row", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "Aminata Kamara", "beneficiary.sex": "female", "geography.district": "Bo", "value_chain.name": "Rice" })],
      BASELINE_RULES,
      CONTEXT,
    );
    expect(report.rowsWithErrors).toBe(0);
    expect(report.validRows).toBe(1);
    expect(report.validationPassRatePercent).toBe(100);
  });

  it("reports missing required fields as errors", () => {
    const report = validateRows([row(1, { "beneficiary.full_name": null, "geography.district": null })], BASELINE_RULES, CONTEXT);
    const codes = report.findings.map((f) => f.ruleCode);
    expect(codes).toContain("REQ-BEN-NAME");
    expect(codes).toContain("REQ-GEO-DISTRICT");
    expect(report.rowsWithErrors).toBe(1);
  });

  it("rejects unrecognised districts and suggests a close match", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "X", "beneficiary.sex": "male", "geography.district": "Bo District" })],
      BASELINE_RULES,
      CONTEXT,
    );
    const finding = report.findings.find((f) => f.ruleCode === "REF-GEO-DISTRICT");
    expect(finding?.severity).toBe("error");
    expect(finding?.suggestedValue).toBe("BO");
  });

  it("rejects unknown value chains and sex values", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "X", "geography.district": "Bo", "value_chain.name": "Quinoa", "beneficiary.sex": "n/a" })],
      BASELINE_RULES,
      CONTEXT,
    );
    const codes = report.findings.map((f) => f.ruleCode);
    expect(codes).toContain("REF-VALUE-CHAIN");
    expect(codes).toContain("TYP-BEN-SEX");
  });

  it("rejects coordinates outside Sierra Leone", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "X", "geography.district": "Bo", "geography.latitude": 51.5, "geography.longitude": -0.12 })],
      BASELINE_RULES,
      CONTEXT,
    );
    const geo = report.findings.filter((f) => f.ruleCode === "GEO-BBOX");
    expect(geo).toHaveLength(2);
    expect(geo[0].category).toBe("geography");
  });

  it("rejects negative cultivated area", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "X", "geography.district": "Bo", "production.cultivated_area_ha": -2 })],
      BASELINE_RULES,
      CONTEXT,
    );
    expect(report.findings.some((f) => f.ruleCode === "RNG-AREA-NON-NEGATIVE")).toBe(true);
  });

  it("flags dates outside the reporting period as warnings", () => {
    const report = validateRows(
      [row(1, { "beneficiary.full_name": "X", "geography.district": "Bo", "production.harvest_date": "2025-01-15" })],
      BASELINE_RULES,
      CONTEXT,
    );
    const finding = report.findings.find((f) => f.ruleCode === "CON-PERIOD-MATCH");
    expect(finding?.severity).toBe("warning");
    expect(report.rowsWithErrors).toBe(0);
  });

  it("flags repeated beneficiaries and duplicate file rows", () => {
    const rows = [
      row(1, { "beneficiary.full_name": "Aminata Kamara", "geography.district": "Bo", "beneficiary.phone": "076111222" }),
      row(2, { "beneficiary.full_name": "Aminata Kamara", "geography.district": "Bo", "beneficiary.phone": "076111222" }),
      row(3, { "beneficiary.full_name": "Mohamed Sesay", "geography.district": "Bo" }),
    ];
    const report = validateRows(rows, BASELINE_RULES, CONTEXT);
    expect(report.findings.some((f) => f.ruleCode === "DUP-BEN-IDENTITY" && f.rowNumber === 2)).toBe(true);
    expect(report.findings.some((f) => f.ruleCode === "DUP-ROW" && f.rowNumber === 3)).toBe(true);
    expect(report.duplicateRows).toBe(2);
  });

  it("surfaces transformation failures as type errors and never drops the row", () => {
    const report = validateRows(
      [
        {
          rowNumber: 1,
          raw: {},
          mapped: {
            values: { "beneficiary.full_name": "X", "geography.district": "Bo" },
            errors: [{ field: "production.quantity", sourceColumn: "qty", message: '"abc" is not numeric.', rawValue: "abc" }],
          },
        },
      ],
      BASELINE_RULES,
      CONTEXT,
    );
    const finding = report.findings.find((f) => f.ruleCode === "TYP-TRANSFORM");
    expect(finding?.severity).toBe("error");
    expect(finding?.rawValue).toBe("abc");
    expect(report.totalRows).toBe(1);
  });

  it("produces a bounded composite quality score", () => {
    const clean = validateRows(
      [row(1, { "beneficiary.full_name": "X", "beneficiary.sex": "male", "geography.district": "Bo" })],
      BASELINE_RULES,
      CONTEXT,
    );
    const score = qualityScore(clean);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(qualityScore(validateRows([], BASELINE_RULES, CONTEXT))).toBe(0);
  });
});
