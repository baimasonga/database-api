import { describe, expect, it } from "vitest";
import { buildQualityTrend, type PeriodRef } from "@/modules/analytics/data-manager-home";

const PERIODS: PeriodRef[] = [
  { id: "p1", code: "2025-Q3", name: "Q3 2025", startDate: new Date("2025-07-01") },
  { id: "p2", code: "2025-Q4", name: "Q4 2025", startDate: new Date("2025-10-01") },
  { id: "p3", code: "2026-Q1", name: "Q1 2026", startDate: new Date("2026-01-01") },
  { id: "p4", code: "2026-Q2", name: "Q2 2026", startDate: new Date("2026-04-01") },
];

function aggregate(id: string, totalRows: number, validRows: number, over: Partial<{ errorRows: number; warningRows: number; importCount: number; qualityScoreSum: number; qualityScoreCount: number }> = {}) {
  return {
    reportingPeriodId: id,
    importCount: over.importCount ?? 1,
    totalRows,
    validRows,
    errorRows: over.errorRows ?? totalRows - validRows,
    warningRows: over.warningRows ?? 0,
    qualityScoreSum: over.qualityScoreSum ?? 0,
    qualityScoreCount: over.qualityScoreCount ?? 0,
  };
}

describe("data quality trend", () => {
  it("computes the pass rate per period", () => {
    const trend = buildQualityTrend([aggregate("p1", 200, 180)], PERIODS);
    expect(trend).toHaveLength(1);
    expect(trend[0].periodCode).toBe("2025-Q3");
    expect(trend[0].passRatePercent).toBe(90);
    expect(trend[0].errorRows).toBe(20);
  });

  it("orders points chronologically regardless of aggregate order", () => {
    const trend = buildQualityTrend(
      [aggregate("p4", 10, 10), aggregate("p1", 10, 5), aggregate("p3", 10, 8)],
      PERIODS,
    );
    expect(trend.map((p) => p.periodCode)).toEqual(["2025-Q3", "2026-Q1", "2026-Q2"]);
  });

  it("omits periods with no imports rather than plotting them as zero", () => {
    const trend = buildQualityTrend([aggregate("p1", 100, 100), aggregate("p4", 100, 50)], PERIODS);
    expect(trend.map((p) => p.periodCode)).toEqual(["2025-Q3", "2026-Q2"]);
  });

  it("keeps the most recent periods when the limit is exceeded", () => {
    const trend = buildQualityTrend(
      PERIODS.map((p) => aggregate(p.id, 10, 10)),
      PERIODS,
      2,
    );
    expect(trend.map((p) => p.periodCode)).toEqual(["2026-Q1", "2026-Q2"]);
  });

  it("reports a null pass rate for a period with no rows, never a false 0%", () => {
    const trend = buildQualityTrend([aggregate("p1", 0, 0)], PERIODS);
    expect(trend[0].passRatePercent).toBeNull();
  });

  it("averages the quality score only over imports that have one", () => {
    const trend = buildQualityTrend(
      [aggregate("p1", 100, 90, { importCount: 3, qualityScoreSum: 180, qualityScoreCount: 2 })],
      PERIODS,
    );
    expect(trend[0].qualityScore).toBe(90);
    expect(trend[0].importCount).toBe(3);
  });

  it("reports a null score when no import carries one", () => {
    const trend = buildQualityTrend([aggregate("p1", 100, 90)], PERIODS);
    expect(trend[0].qualityScore).toBeNull();
  });

  it("rounds the pass rate to one decimal place", () => {
    const trend = buildQualityTrend([aggregate("p1", 3, 2)], PERIODS);
    expect(trend[0].passRatePercent).toBe(66.7);
  });

  it("returns nothing when no period has imports", () => {
    expect(buildQualityTrend([], PERIODS)).toEqual([]);
  });

  it("ignores aggregates for periods that no longer exist", () => {
    const trend = buildQualityTrend([aggregate("deleted-period", 10, 10)], PERIODS);
    expect(trend).toEqual([]);
  });

  it("does not leak the internal sort key into the result", () => {
    const trend = buildQualityTrend([aggregate("p1", 10, 10)], PERIODS);
    expect(trend[0]).not.toHaveProperty("startDate");
  });
});
