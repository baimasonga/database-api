import { describe, expect, it } from "vitest";
import {
  DOMAIN_LABELS,
  domainForCalculationRef,
  qualityStatusFor,
  type ContributingPublication,
} from "@/modules/analytics/lineage";

function publication(over: Partial<ContributingPublication> = {}): ContributingPublication {
  return {
    publicationRecordId: "pub-1",
    importJobId: "job-1",
    datasetName: "Farmer Registry",
    datasetCode: "DS-FARMER-REGISTRY",
    dataSourceName: "AVDP Farmer Registry",
    dataSourceCode: "SRC-FARMER-REGISTRY",
    reportingPeriodCode: "2026-Q2",
    publishedAt: new Date("2026-06-30T00:00:00Z"),
    publishedRowCount: 100,
    qualityScore: 95,
    errorRowCount: 0,
    warningRowCount: 0,
    ...over,
  };
}

describe("calculation reference to record set", () => {
  it("maps each beneficiary reference to the beneficiary records", () => {
    for (const ref of ["beneficiaries.total", "beneficiaries.female", "beneficiaries.male", "beneficiaries.youth"]) {
      expect(domainForCalculationRef(ref)).toBe("beneficiaries");
    }
  });

  it("maps training, production and infrastructure references", () => {
    expect(domainForCalculationRef("training.participants")).toBe("training");
    expect(domainForCalculationRef("training.events")).toBe("training");
    expect(domainForCalculationRef("production.area")).toBe("production");
    expect(domainForCalculationRef("production.quantity")).toBe("production");
    expect(domainForCalculationRef("infrastructure.assets")).toBe("infrastructure");
  });

  it("returns null for an unmapped or missing reference rather than guessing", () => {
    expect(domainForCalculationRef(null)).toBeNull();
    expect(domainForCalculationRef("something.else")).toBeNull();
    expect(domainForCalculationRef("")).toBeNull();
  });

  it("labels every domain it can return", () => {
    for (const domain of ["beneficiaries", "training", "production", "infrastructure"] as const) {
      expect(DOMAIN_LABELS[domain]).toBeTruthy();
    }
  });
});

describe("data quality status", () => {
  it("is unavailable when nothing contributes", () => {
    expect(qualityStatusFor([])).toBe("unavailable");
  });

  it("is validated when every contributing publication is clean", () => {
    expect(qualityStatusFor([publication(), publication({ publicationRecordId: "pub-2" })])).toBe("validated");
  });

  it("is downgraded when any contributing publication carries warnings", () => {
    const mixed = [publication(), publication({ publicationRecordId: "pub-2", warningRowCount: 3 })];
    expect(qualityStatusFor(mixed)).toBe("warnings");
  });

  it("does not let one clean dataset mask warnings in another", () => {
    // Order must not matter: a single warning downgrades the whole figure.
    const warnFirst = [publication({ warningRowCount: 1 }), publication({ publicationRecordId: "pub-2" })];
    expect(qualityStatusFor(warnFirst)).toBe("warnings");
  });
});
