import { getDashboardProvider } from "@/data";
import { DashboardDataUnavailable, type DashboardFilterInput, type IndicatorLineage } from "@/data/types";
import { SiteHeader } from "@/components/site-header";
import { DashboardFilters } from "@/components/dashboard-filters";
import { IndicatorLineagePanel } from "@/components/indicator-lineage";
import { BarList, DataUnavailable, KpiCard, ProgressBar, formatDate, formatNumber } from "@/components/ui";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters: DashboardFilterInput = {
    reportingPeriod: one(params.reporting_period),
    district: one(params.district),
    valueChain: one(params.value_chain),
  };

  const provider = getDashboardProvider();

  let content: Awaited<ReturnType<typeof loadDashboard>> | null = null;
  let failure: string | null = null;
  try {
    content = await loadDashboard(provider, filters);
  } catch (error) {
    if (error instanceof DashboardDataUnavailable) failure = `${error.endpoint} — ${error.message}`;
    else throw error;
  }

  return (
    <div className="min-h-screen">
      <SiteHeader current="dashboard" />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">
              AVDP Performance Dashboard
            </h1>
            <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
              Agricultural Value Chain Development Project — Sierra Leone
            </p>
          </div>
          {content ? (
            <p className="text-xs text-[color:var(--color-ink-400)]">
              {content.summary.meta.reportingPeriod ?? "All periods"} · updated {formatDate(content.summary.meta.lastUpdated)} ·{" "}
              {env.dataMode() === "live" ? "live analytics data" : "illustrative prototype data"}
            </p>
          ) : null}
        </div>

        {failure ? <DataUnavailable detail={failure} /> : null}

        {content ? (
          <>
            <DashboardFilters
              periods={content.periodOptions}
              districts={content.districts.data.map((d) => ({ value: d.code, label: d.name }))}
              valueChains={content.valueChains.data.map((v) => ({ value: v.code, label: v.name }))}
              active={{
                reporting_period: filters.reportingPeriod,
                district: filters.district,
                value_chain: filters.valueChain,
              }}
            />

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Farmers reached"
                value={formatNumber(content.summary.data.beneficiaries.total)}
                sub={
                  <>
                    {formatNumber(content.summary.data.beneficiaries.female)} women (
                    {content.summary.data.beneficiaries.femaleSharePercent}%) ·{" "}
                    {formatNumber(content.summary.data.beneficiaries.youth)} youth
                    <IndicatorLineagePanel lineage={content.lineage["AVDP-OUT-001"] ?? null} />
                  </>
                }
              />
              <KpiCard
                label="Participants trained"
                value={formatNumber(content.summary.data.training.participantsTrained)}
                sub={
                  <>
                    {formatNumber(content.summary.data.training.trainingEvents)} events ·{" "}
                    {formatNumber(content.summary.data.training.certified)} certified
                    <IndicatorLineagePanel lineage={content.lineage["AVDP-OUT-004"] ?? null} />
                  </>
                }
              />
              <KpiCard
                label="Area under production"
                value={formatNumber(content.summary.data.production.totalAreaHa)}
                unit="ha"
                sub={
                  <>
                    {formatNumber(content.summary.data.production.totalQuantity)} total output ·{" "}
                    {content.summary.data.production.avgYieldPerHa === null
                      ? "yield —"
                      : `${formatNumber(content.summary.data.production.avgYieldPerHa, 2)} per ha`}
                    <IndicatorLineagePanel lineage={content.lineage["AVDP-OUT-005"] ?? null} />
                  </>
                }
              />
              <KpiCard
                label="Infrastructure delivered"
                value={formatNumber(content.summary.data.infrastructure.assetCount)}
                unit="assets"
                sub={
                  <>
                    {formatNumber(content.summary.data.infrastructure.completedCount)} completed ·{" "}
                    {formatNumber(content.summary.data.infrastructure.beneficiariesServed)} served
                    <IndicatorLineagePanel lineage={content.lineage["AVDP-OUT-006"] ?? null} />
                  </>
                }
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="card lg:col-span-2">
                <h2 className="mb-4 text-sm font-semibold">Indicator performance against target</h2>
                <ul className="flex flex-col gap-4">
                  {content.indicators.data.map((indicator) => (
                    <li key={indicator.code} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{indicator.shortName ?? indicator.name}</span>
                        <span className="text-sm tabular-nums text-[color:var(--color-ink-600)]">
                          {formatNumber(indicator.actual)}
                          {indicator.target === null ? "" : ` / ${formatNumber(indicator.target)}`}
                          {indicator.unit ? ` ${indicator.unit}` : ""}
                          {indicator.achievementPercent === null ? "" : ` · ${indicator.achievementPercent}%`}
                        </span>
                      </div>
                      <ProgressBar percent={indicator.achievementPercent} />
                      <span className="text-xs text-[color:var(--color-ink-400)]">{indicator.code}</span>
                    </li>
                  ))}
                  {content.indicators.data.length === 0 ? (
                    <li className="text-sm text-[color:var(--color-ink-400)]">
                      No indicators have published values for the selected filters.
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="card">
                <h2 className="mb-4 text-sm font-semibold">Beneficiaries by value chain</h2>
                <BarList
                  items={content.valueChains.data.map((v) => ({
                    label: v.name,
                    value: v.beneficiaries,
                    hint: v.areaHa > 0 ? `${formatNumber(v.areaHa)} ha` : undefined,
                  }))}
                />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <h2 className="mb-4 text-sm font-semibold">Geographic coverage</h2>
                <BarList
                  items={content.districts.data.map((d) => ({
                    label: d.name,
                    value: d.beneficiaries,
                    hint: `${formatNumber(d.participantsTrained)} trained`,
                  }))}
                />
              </div>
              <div className="card">
                <h2 className="mb-4 text-sm font-semibold">Infrastructure by asset type</h2>
                <BarList
                  items={content.infrastructure.data.byType.map((t) => ({
                    label: t.assetType,
                    value: t.assetCount,
                    hint: `${formatNumber(t.completedCount)} complete`,
                  }))}
                />
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

async function loadDashboard(
  provider: ReturnType<typeof getDashboardProvider>,
  filters: DashboardFilterInput,
) {
  const [summary, indicators, districts, valueChains, infrastructure] = await Promise.all([
    provider.getDashboardSummary(filters),
    provider.getIndicatorPerformance(filters),
    provider.getDistrictSummary({ ...filters, district: undefined }),
    provider.getValueChainSummary({ ...filters, valueChain: undefined }),
    provider.getInfrastructureSummary(filters),
  ]);

  const lineageCodes = ["AVDP-OUT-001", "AVDP-OUT-004", "AVDP-OUT-005", "AVDP-OUT-006"];
  const lineageEntries = await Promise.all(
    lineageCodes.map(async (code) => {
      try {
        const result = await provider.getIndicatorLineage(code, filters);
        return [code, result.data] as const;
      } catch {
        // Lineage is supplementary: its absence must not blank the dashboard.
        return [code, null] as const;
      }
    }),
  );

  const periodOptions = buildPeriodOptions(summary.meta.reportingPeriod);

  return {
    summary,
    indicators,
    districts,
    valueChains,
    infrastructure,
    lineage: Object.fromEntries(lineageEntries) as Record<string, IndicatorLineage | null>,
    periodOptions,
  };
}

function buildPeriodOptions(current: string | null) {
  const year = current ? Number.parseInt(current.slice(0, 4), 10) : new Date().getUTCFullYear();
  const base = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  return [base - 1, base].flatMap((y) => [1, 2, 3, 4].map((q) => ({ value: `${y}-Q${q}`, label: `Q${q} ${y}` })));
}
