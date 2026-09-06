import { Suspense } from "react";
import {
  loadDashboardSummary,
  loadDistrictSummary,
  loadFilterOptions,
  loadIndicatorPerformance,
  loadInfrastructureSummary,
  loadLineageFor,
  loadValueChainSummary,
} from "@/data/dashboard-service";
import type { DashboardFilterInput } from "@/data/types";
import { SiteHeader } from "@/components/site-header";
import { DashboardFilters } from "@/components/dashboard-filters";
import { IndicatorLineagePanel } from "@/components/indicator-lineage";
import {
  KpiRowSkeleton,
  PanelSkeleton,
  Section,
  SkeletonBlock,
} from "@/components/section-state";
import { BarList, KpiCard, ProgressBar, formatDate, formatNumber } from "@/components/ui";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The AVDP dashboard.
 *
 * Every section streams independently through Suspense and loads via the
 * dashboard service, so a slow or failing section shows its own loading or
 * unavailable state instead of blocking or blanking the whole page. No
 * component here knows whether the numbers came from mock fixtures or the
 * live analytics API.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters: DashboardFilterInput = {
    reportingPeriod: one(params.reporting_period),
    district: one(params.district),
    valueChain: one(params.value_chain),
  };

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
          <Suspense fallback={<SkeletonBlock className="h-3 w-72" />}>
            <DataProvenance filters={filters} />
          </Suspense>
        </div>

        <Suspense fallback={<PanelSkeleton rows={3} title="Filters" />}>
          <FilterBar filters={filters} />
        </Suspense>

        <Suspense fallback={<KpiRowSkeleton />}>
          <HeadlineKpis filters={filters} />
        </Suspense>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<PanelSkeleton rows={6} title="Indicator performance against target" />}>
              <IndicatorPanel filters={filters} />
            </Suspense>
          </div>
          <Suspense fallback={<PanelSkeleton rows={6} title="Beneficiaries by value chain" />}>
            <ValueChainPanel filters={filters} />
          </Suspense>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Suspense fallback={<PanelSkeleton rows={8} title="Geographic coverage" />}>
            <GeographyPanel filters={filters} />
          </Suspense>
          <Suspense fallback={<PanelSkeleton rows={6} title="Infrastructure by asset type" />}>
            <InfrastructurePanel filters={filters} />
          </Suspense>
        </section>
      </main>
    </div>
  );
}

async function DataProvenance({ filters }: { filters: DashboardFilterInput }) {
  const summary = await loadDashboardSummary(filters);
  if (summary.status === "unavailable") return null;

  return (
    <p className="text-xs text-[color:var(--color-ink-400)]">
      {summary.meta.reportingPeriod ?? "All periods"} · updated {formatDate(summary.meta.lastUpdated)} ·{" "}
      {env.dataMode() === "live" ? "live analytics data" : "illustrative prototype data"}
    </p>
  );
}

async function FilterBar({ filters }: { filters: DashboardFilterInput }) {
  const options = await loadFilterOptions(filters);
  return (
    <DashboardFilters
      periods={options.periods}
      districts={options.districts}
      valueChains={options.valueChains}
      active={{
        reporting_period: filters.reportingPeriod,
        district: filters.district,
        value_chain: filters.valueChain,
      }}
    />
  );
}

const LINEAGE_CODES = ["AVDP-OUT-001", "AVDP-OUT-004", "AVDP-OUT-005", "AVDP-OUT-006"];

async function HeadlineKpis({ filters }: { filters: DashboardFilterInput }) {
  const [summary, lineage] = await Promise.all([
    loadDashboardSummary(filters),
    loadLineageFor(LINEAGE_CODES, filters),
  ]);

  return (
    <Section title="Headline results" result={summary}>
      {(data) => (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Farmers reached"
            value={formatNumber(data.beneficiaries.total)}
            sub={
              <>
                {formatNumber(data.beneficiaries.female)} women ({data.beneficiaries.femaleSharePercent}%) ·{" "}
                {formatNumber(data.beneficiaries.youth)} youth
                <IndicatorLineagePanel lineage={lineage["AVDP-OUT-001"] ?? null} />
              </>
            }
          />
          <KpiCard
            label="Participants trained"
            value={formatNumber(data.training.participantsTrained)}
            sub={
              <>
                {formatNumber(data.training.trainingEvents)} events · {formatNumber(data.training.certified)} certified
                <IndicatorLineagePanel lineage={lineage["AVDP-OUT-004"] ?? null} />
              </>
            }
          />
          <KpiCard
            label="Area under production"
            value={formatNumber(data.production.totalAreaHa)}
            unit="ha"
            sub={
              <>
                {formatNumber(data.production.totalQuantity)} total output ·{" "}
                {data.production.avgYieldPerHa === null
                  ? "yield —"
                  : `${formatNumber(data.production.avgYieldPerHa, 2)} per ha`}
                <IndicatorLineagePanel lineage={lineage["AVDP-OUT-005"] ?? null} />
              </>
            }
          />
          <KpiCard
            label="Infrastructure delivered"
            value={formatNumber(data.infrastructure.assetCount)}
            unit="assets"
            sub={
              <>
                {formatNumber(data.infrastructure.completedCount)} completed ·{" "}
                {formatNumber(data.infrastructure.beneficiariesServed)} served
                <IndicatorLineagePanel lineage={lineage["AVDP-OUT-006"] ?? null} />
              </>
            }
          />
        </section>
      )}
    </Section>
  );
}

async function IndicatorPanel({ filters }: { filters: DashboardFilterInput }) {
  const indicators = await loadIndicatorPerformance(filters);
  const title = "Indicator performance against target";

  return (
    <Section title={title} result={indicators}>
      {(rows) => (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold">{title}</h2>
          <ul className="flex flex-col gap-4">
            {rows.map((indicator) => (
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
          </ul>
        </div>
      )}
    </Section>
  );
}

async function ValueChainPanel({ filters }: { filters: DashboardFilterInput }) {
  const valueChains = await loadValueChainSummary(filters);
  const title = "Beneficiaries by value chain";

  return (
    <Section title={title} result={valueChains}>
      {(rows) => (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold">{title}</h2>
          <BarList
            items={rows.map((v) => ({
              label: v.name,
              value: v.beneficiaries,
              hint: v.areaHa > 0 ? `${formatNumber(v.areaHa)} ha` : undefined,
            }))}
          />
        </div>
      )}
    </Section>
  );
}

async function GeographyPanel({ filters }: { filters: DashboardFilterInput }) {
  // District coverage always shows every district, so the panel is not
  // narrowed by the district filter itself.
  const districts = await loadDistrictSummary({ ...filters, district: undefined });
  const title = "Geographic coverage";

  return (
    <Section title={title} result={districts}>
      {(rows) => (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold">{title}</h2>
          <BarList
            items={rows.map((d) => ({
              label: d.name,
              value: d.beneficiaries,
              hint: `${formatNumber(d.participantsTrained)} trained`,
            }))}
          />
        </div>
      )}
    </Section>
  );
}

async function InfrastructurePanel({ filters }: { filters: DashboardFilterInput }) {
  const infrastructure = await loadInfrastructureSummary(filters);
  const title = "Infrastructure by asset type";

  return (
    <Section title={title} result={infrastructure}>
      {(data) => (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold">{title}</h2>
          <BarList
            items={data.byType.map((t) => ({
              label: t.assetType,
              value: t.assetCount,
              hint: `${formatNumber(t.completedCount)} complete`,
            }))}
          />
        </div>
      )}
    </Section>
  );
}
