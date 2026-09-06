import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getIndicatorPerformance, resolveFilters } from "@/modules/analytics/queries";
import { Badge, KpiCard, ProgressBar, formatDate, formatNumber } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IndicatorDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const indicator = await prisma.indicator.findUnique({
    where: { code: decodeURIComponent(code) },
    include: {
      primaryDataSource: true,
      disaggregations: true,
      targets: { include: { reportingPeriod: true, district: true, valueChain: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!indicator) notFound();

  const resolved = await resolveFilters({});
  const performance = (await getIndicatorPerformance(resolved, indicator.code))[0] ?? null;

  const publications = await prisma.publicationRecord.findMany({
    where: { status: "published", ...(resolved.reportingPeriodId ? { reportingPeriodId: resolved.reportingPeriodId } : {}) },
    orderBy: { publishedAt: "desc" },
    take: 10,
    include: { dataset: { include: { dataSource: true } }, reportingPeriod: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/data-manager/indicators" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
          ← Indicators
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">{indicator.name}</h1>
        <p className="mt-1 font-mono text-xs text-[color:var(--color-ink-400)]">{indicator.code}</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Actual" value={formatNumber(performance?.actual_value ?? 0)} unit={indicator.unit} />
        <KpiCard label="Target" value={performance?.target_value === null || performance?.target_value === undefined ? "—" : formatNumber(performance.target_value)} unit={indicator.unit} />
        <KpiCard
          label="Achievement"
          value={performance?.achievement_percent === null || performance?.achievement_percent === undefined ? "—" : `${performance.achievement_percent}%`}
          sub={<ProgressBar percent={performance?.achievement_percent ?? null} />}
        />
        <KpiCard
          label="Data quality"
          value={publications.length > 0 ? "Validated" : "Not published"}
          sub={`last updated ${formatDate(performance?.last_calculated_at ?? null)}`}
        />
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Definition and calculation</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Definition", indicator.definition ?? "—"],
            ["Description", indicator.description ?? "—"],
            ["Calculation method", indicator.calculationMethod ?? "—"],
            ["Calculation reference", indicator.calculationRef ?? "—"],
            ["Calculation version", String(indicator.calculationVersion)],
            ["Reporting frequency", indicator.frequency.replace(/_/g, " ")],
            ["Responsible unit", indicator.responsibleUnit ?? "—"],
            ["Primary data source", indicator.primaryDataSource?.name ?? "—"],
            ["Disaggregation dimensions", indicator.disaggregations.map((d) => d.dimension).join(", ") || "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Targets</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Reporting period</th>
              <th>Fiscal year</th>
              <th>District</th>
              <th>Value chain</th>
              <th className="text-right">Target</th>
            </tr>
          </thead>
          <tbody>
            {indicator.targets.map((target) => (
              <tr key={target.id}>
                <td>{target.reportingPeriod?.code ?? "—"}</td>
                <td>{target.fiscalYear ?? "—"}</td>
                <td>{target.district?.name ?? "All"}</td>
                <td>{target.valueChain?.name ?? "All"}</td>
                <td className="text-right tabular-nums">{formatNumber(Number(target.targetValue))}</td>
              </tr>
            ))}
            {indicator.targets.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-[color:var(--color-ink-400)]">
                  No targets recorded for this indicator.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Indicator data sources</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {publications.map((publication) => (
            <li key={publication.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                {publication.dataset.name}{" "}
                <span className="text-xs text-[color:var(--color-ink-600)]">via {publication.dataset.dataSource.name}</span>
              </span>
              <span className="text-xs text-[color:var(--color-ink-600)]">
                <Badge tone="success">published</Badge> {publication.reportingPeriod.code} ·{" "}
                {formatDate(publication.publishedAt)}
              </span>
            </li>
          ))}
          {publications.length === 0 ? (
            <li className="text-[color:var(--color-ink-400)]">
              No published datasets yet contribute to this indicator.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
