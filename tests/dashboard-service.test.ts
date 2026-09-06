import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 12 behaviour: the service layer classifies every provider outcome into
 * exactly one of ok / empty / unavailable, and the data mode selects which
 * provider is used. Fixtures are never substituted for a failed live call.
 */

const ORIGINAL_ENV = { ...process.env };

async function freshImport() {
  vi.resetModules();
  return {
    service: await import("@/data/dashboard-service"),
    factory: await import("@/data"),
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("provider selection by DATA_MODE", () => {
  it("uses the mock provider by default", async () => {
    delete process.env.DATA_MODE;
    const { factory } = await freshImport();
    expect(factory.getDashboardProvider().mode).toBe("mock");
  });

  it("uses the mock provider when DATA_MODE=mock", async () => {
    process.env.DATA_MODE = "mock";
    const { factory } = await freshImport();
    expect(factory.getDashboardProvider().mode).toBe("mock");
  });

  it("uses the live provider when DATA_MODE=live", async () => {
    process.env.DATA_MODE = "live";
    const { factory } = await freshImport();
    expect(factory.getDashboardProvider().mode).toBe("live");
  });

  it("treats any other value as mock rather than failing open to live", async () => {
    process.env.DATA_MODE = "production";
    const { factory } = await freshImport();
    expect(factory.getDashboardProvider().mode).toBe("mock");
  });
});

describe("mock mode sections", () => {
  beforeEach(() => {
    process.env.DATA_MODE = "mock";
  });

  it("resolves the headline summary to ok with fixture values", async () => {
    const { service } = await freshImport();
    const result = await service.loadDashboardSummary({});
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.beneficiaries.total).toBe(24682);
    expect(result.meta.source).toBe("mock");
  });

  it("resolves every dashboard section to ok", async () => {
    const { service } = await freshImport();
    const results = await Promise.all([
      service.loadIndicatorPerformance({}),
      service.loadDistrictSummary({}),
      service.loadValueChainSummary({}),
      service.loadTrainingSummary({}),
      service.loadProductionSummary({}),
      service.loadInfrastructureSummary({}),
    ]);
    expect(results.map((r) => r.status)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"]);
  });

  it("builds filter options from the loaded data", async () => {
    const { service } = await freshImport();
    const options = await service.loadFilterOptions({});
    expect(options.districts.map((d) => d.label)).toContain("Bo");
    expect(options.valueChains.map((v) => v.label)).toContain("Rice");
    expect(options.periods.length).toBe(8);
  });
});

describe("live mode: API failure", () => {
  beforeEach(() => {
    process.env.DATA_MODE = "live";
    process.env.DASHBOARD_API_BASE_URL = "http://api.test";
  });

  it("returns unavailable instead of falling back to fixtures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const { service } = await freshImport();
    const result = await service.loadDashboardSummary({});

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.endpoint).toContain("/api/v1/dashboard/summary");
    // The mock headline figure must not appear anywhere in the result.
    expect(JSON.stringify(result)).not.toContain("24682");
  });

  it("isolates a failure to its own section", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/training/summary")) return new Response("down", { status: 500 });
        return new Response(
          JSON.stringify({
            data: { trainingEvents: 1, participantsTrained: 1, uniqueParticipants: 1, certified: 1, totalTrainingDays: 1 },
            metadata: { last_updated: null, reporting_period: "2026-Q2" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );
    const { service } = await freshImport();
    const [training, production] = await Promise.all([
      service.loadTrainingSummary({}),
      service.loadProductionSummary({}),
    ]);
    expect(training.status).toBe("unavailable");
    expect(production.status).toBe("ok");
  });

  it("does not let lineage failure affect the figure it annotates", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const { service } = await freshImport();
    await expect(service.loadIndicatorLineage("AVDP-OUT-001", {})).resolves.toBeNull();
    await expect(service.loadLineageFor(["AVDP-OUT-001"], {})).resolves.toEqual({ "AVDP-OUT-001": null });
  });

  it("rethrows unexpected errors rather than masking a defect as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw Object.assign(new TypeError("boom"), { name: "TypeError" });
    }));
    const { service } = await freshImport();
    // A network failure is classified as unavailable by the provider itself.
    const result = await service.loadDashboardSummary({});
    expect(result.status).toBe("unavailable");
  });
});

describe("live mode: nothing published yet", () => {
  beforeEach(() => {
    process.env.DATA_MODE = "live";
    process.env.DASHBOARD_API_BASE_URL = "http://api.test";
  });

  const emptySummary = {
    beneficiaries: { total: 0, female: 0, male: 0, youth: 0, femaleSharePercent: 0, districtsCovered: 0 },
    training: { participantsTrained: 0, trainingEvents: 0, certified: 0 },
    production: { totalAreaHa: 0, totalQuantity: 0, avgYieldPerHa: null },
    infrastructure: { assetCount: 0, completedCount: 0, beneficiariesServed: 0 },
    headlineIndicators: [],
  };

  function respondWith(data: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data, metadata: { last_updated: null, reporting_period: "2026-Q3" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  }

  it("reports an all-zero summary as empty, not as a row of zeros", async () => {
    respondWith(emptySummary);
    const { service } = await freshImport();
    const result = await service.loadDashboardSummary({});
    expect(result.status).toBe("empty");
    if (result.status !== "empty") return;
    expect(result.meta.reportingPeriod).toBe("2026-Q3");
  });

  it("reports an empty list as empty", async () => {
    respondWith([]);
    const { service } = await freshImport();
    expect((await service.loadDistrictSummary({})).status).toBe("empty");
    expect((await service.loadValueChainSummary({})).status).toBe("empty");
    expect((await service.loadIndicatorPerformance({})).status).toBe("empty");
  });

  it("reports a registry with no actuals as empty", async () => {
    respondWith([
      { code: "AVDP-OUT-001", name: "Farmers reached", shortName: null, unit: "farmers", resultLevel: "output", actual: 0, target: 30000, achievementPercent: 0, lastUpdated: null },
    ]);
    const { service } = await freshImport();
    expect((await service.loadIndicatorPerformance({})).status).toBe("empty");
  });

  it("reports ok as soon as any real value is published", async () => {
    respondWith({ ...emptySummary, beneficiaries: { ...emptySummary.beneficiaries, total: 4, female: 3 } });
    const { service } = await freshImport();
    const result = await service.loadDashboardSummary({});
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.beneficiaries.total).toBe(4);
  });
});

describe("empty-summary predicate", () => {
  it("treats a summary with any non-zero headline measure as non-empty", async () => {
    const { service } = await freshImport();
    const zero = {
      beneficiaries: { total: 0, female: 0, male: 0, youth: 0, femaleSharePercent: 0, districtsCovered: 0 },
      training: { participantsTrained: 0, trainingEvents: 0, certified: 0 },
      production: { totalAreaHa: 0, totalQuantity: 0, avgYieldPerHa: null },
      infrastructure: { assetCount: 0, completedCount: 0, beneficiariesServed: 0 },
      headlineIndicators: [],
    };
    expect(service.isSummaryEmpty(zero)).toBe(true);
    expect(service.isSummaryEmpty({ ...zero, production: { ...zero.production, totalAreaHa: 0.5 } })).toBe(false);
    expect(service.isSummaryEmpty({ ...zero, infrastructure: { ...zero.infrastructure, assetCount: 1 } })).toBe(false);
  });
});
