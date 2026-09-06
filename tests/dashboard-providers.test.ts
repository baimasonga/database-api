import { afterEach, describe, expect, it, vi } from "vitest";
import { MockDashboardDataProvider } from "@/data/providers/mock";
import { LiveDashboardDataProvider } from "@/data/providers/live";
import { DashboardDataUnavailable } from "@/data/types";
import { MOCK_SUMMARY } from "@/data/mock/fixtures";

describe("mock provider", () => {
  const provider = new MockDashboardDataProvider();

  it("keeps the prototype dashboard working unchanged", async () => {
    const summary = await provider.getDashboardSummary();
    expect(summary.data).toEqual(MOCK_SUMMARY);
    expect(summary.meta.source).toBe("mock");
  });

  it("narrows fixtures by district without inventing values", async () => {
    const summary = await provider.getDashboardSummary({ district: "Bo" });
    expect(summary.data.beneficiaries.total).toBe(3120);
    const districts = await provider.getDistrictSummary({ district: "SL-BO" });
    expect(districts.data).toHaveLength(1);
    expect(districts.data[0].name).toBe("Bo");
  });

  it("serves every method on the contract", async () => {
    await expect(provider.getIndicatorPerformance()).resolves.toBeTruthy();
    await expect(provider.getValueChainSummary()).resolves.toBeTruthy();
    await expect(provider.getTrainingSummary()).resolves.toBeTruthy();
    await expect(provider.getProductionSummary()).resolves.toBeTruthy();
    await expect(provider.getInfrastructureSummary()).resolves.toBeTruthy();
    const lineage = await provider.getIndicatorLineage("AVDP-OUT-001");
    expect(lineage.data?.dataQualityStatus).toBe("unavailable");
  });
});

describe("live provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps the API envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: { beneficiaries: { total: 12 } },
            metadata: { last_updated: "2026-06-30T00:00:00.000Z", reporting_period: "2026-Q2" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const provider = new LiveDashboardDataProvider("http://api.test");
    const result = await provider.getDashboardSummary({ district: "Bo", reportingPeriod: "2026-Q2" });
    expect(result.meta.source).toBe("analytics");
    expect(result.meta.reportingPeriod).toBe("2026-Q2");

    const call = (globalThis.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(call).toContain("/api/v1/dashboard/summary?");
    expect(call).toContain("district=Bo");
  });

  it("raises DashboardDataUnavailable instead of falling back to fixtures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const provider = new LiveDashboardDataProvider("http://api.test");
    await expect(provider.getDashboardSummary()).rejects.toBeInstanceOf(DashboardDataUnavailable);
  });

  it("raises DashboardDataUnavailable on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const provider = new LiveDashboardDataProvider("http://api.test");
    await expect(provider.getIndicatorPerformance()).rejects.toThrow(/ECONNREFUSED/);
  });
});
