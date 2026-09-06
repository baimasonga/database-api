import { describe, expect, it } from "vitest";
import {
  INVENTORY_COLUMNS,
  InventoryRowError,
  connectionTypeFor,
  domainFor,
  frequencyFor,
  inventoryCode,
  isYes,
  planFromInventoryRow,
  sourceTypeFor,
} from "@/modules/governance/inventory";

const FARMER_ROW = {
  "Source Name": "AVDP Farmer Registry",
  "Owning Unit": "M&E Unit",
  "Repository Location": "Shared drive / M&E / Farmer Registry",
  "File Name": "farmer_registry_2026Q2.xlsx",
  "File Type": "XLSX",
  Description: "One row per registered farmer with geography and value chain",
  "Primary Identifier": "beneficiary.project_id",
  Frequency: "Quarterly",
  "Contains Beneficiary Data": "Yes",
  "Contains Personal Data": "Yes",
  "Integration Method": "Upload",
  "Known Quality Issues": "District spellings inconsistent",
  Notes: "Master list",
};

describe("inventory template", () => {
  it("declares the columns the Phase 14 template requires", () => {
    for (const column of ["Source Name", "Owning Unit", "Repository Location", "File Name", "File Type",
      "Description", "Reporting Period", "Geographic Coverage", "Value Chain", "Approximate Rows",
      "Primary Identifier", "Frequency", "Contains Beneficiary Data", "Contains Personal Data",
      "Integration Method", "Known Quality Issues", "Status", "Notes"]) {
      expect(INVENTORY_COLUMNS).toContain(column);
    }
  });
});

describe("field coercion", () => {
  it("maps file types onto source types, defaulting to other", () => {
    expect(sourceTypeFor("XLSX")).toBe("excel");
    expect(sourceTypeFor("csv")).toBe("csv");
    expect(sourceTypeFor("ODK")).toBe("odk");
    expect(sourceTypeFor("something else")).toBe("other");
    expect(sourceTypeFor(undefined)).toBe("other");
  });

  it("maps integration methods, defaulting to upload", () => {
    expect(connectionTypeFor("API")).toBe("api");
    expect(connectionTypeFor(" scheduled ")).toBe("scheduled");
    expect(connectionTypeFor(undefined)).toBe("upload");
  });

  it("maps frequency spellings, defaulting to ad hoc", () => {
    expect(frequencyFor("Quarterly")).toBe("quarterly");
    expect(frequencyFor("SEMI-ANNUAL")).toBe("semi_annual");
    expect(frequencyFor("yearly")).toBe("annual");
    expect(frequencyFor("whenever")).toBe("ad_hoc");
  });

  it("reads affirmative flags tolerantly", () => {
    expect(isYes("Yes")).toBe(true);
    expect(isYes("Y")).toBe(true);
    expect(isYes("TRUE")).toBe(true);
    expect(isYes("No")).toBe(false);
    expect(isYes(undefined)).toBe(false);
  });

  it("builds stable prefixed codes", () => {
    expect(inventoryCode("AVDP Farmer Registry", "SRC")).toBe("SRC-AVDP-FARMER-REGISTRY");
    expect(inventoryCode("Training (attendance) records!", "DS")).toBe("DS-TRAINING-ATTENDANCE-RECORDS");
    expect(inventoryCode("a".repeat(80), "SRC").length).toBeLessThanOrEqual(44);
  });
});

describe("domain inference", () => {
  it("infers from the description", () => {
    expect(domainFor({ Description: "Training attendance sheets" })).toBe("training");
    expect(domainFor({ Description: "Civil works progress by asset" })).toBe("infrastructure");
    expect(domainFor({ Description: "Seasonal harvest yield returns" })).toBe("production");
    expect(domainFor({ Description: "Seed and fertiliser distribution" })).toBe("inputs");
  });

  it("falls back to beneficiaries when the row holds beneficiary data", () => {
    expect(domainFor({ Description: "Registry", "Contains Beneficiary Data": "Yes" })).toBe("beneficiaries");
  });

  it("falls back to other when nothing is inferable", () => {
    expect(domainFor({ Description: "Miscellaneous notes" })).toBe("other");
  });
});

describe("registration plan", () => {
  it("maps a full inventory row onto a source and dataset", () => {
    const plan = planFromInventoryRow(FARMER_ROW);

    expect(plan.source.code).toBe("SRC-AVDP-FARMER-REGISTRY");
    expect(plan.source.sourceType).toBe("excel");
    expect(plan.source.connectionType).toBe("upload");
    expect(plan.source.frequency).toBe("quarterly");
    expect(plan.source.ownerUnit).toBe("M&E Unit");
    expect(plan.source.notes).toBe("District spellings inconsistent | Master list");

    expect(plan.dataset.code).toBe("DS-AVDP-FARMER-REGISTRY");
    expect(plan.dataset.name).toBe("farmer_registry_2026Q2.xlsx");
    expect(plan.dataset.domain).toBe("beneficiaries");
    expect(plan.dataset.primaryIdentifier).toBe("beneficiary.project_id");
  });

  it("classifies personal data as confidential", () => {
    expect(planFromInventoryRow(FARMER_ROW).source.dataClassification).toBe("confidential");
    expect(
      planFromInventoryRow({ ...FARMER_ROW, "Contains Personal Data": "No" }).source.dataClassification,
    ).toBe("internal");
  });

  it("falls back to the source name when no file name is given", () => {
    const plan = planFromInventoryRow({ ...FARMER_ROW, "File Name": "" });
    expect(plan.dataset.name).toBe("AVDP Farmer Registry");
  });

  it("normalises blank optional fields to null rather than empty strings", () => {
    const plan = planFromInventoryRow({
      "Source Name": "Bare Row",
      "Owning Unit": "  ",
      Description: "",
      "Known Quality Issues": "",
      Notes: "",
    });
    expect(plan.source.ownerUnit).toBeNull();
    expect(plan.source.description).toBeNull();
    expect(plan.source.notes).toBeNull();
    expect(plan.source.repositoryLocation).toBeNull();
  });

  it("rejects a row with no source name", () => {
    expect(() => planFromInventoryRow({ Description: "orphan" })).toThrow(InventoryRowError);
  });
});
