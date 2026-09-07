import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getIndicatorPerformance, resolveFilters } from "@/modules/analytics/queries";
import { DOMAIN_LABELS, indicatorLineage } from "@/modules/analytics/lineage";
import { Badge, KpiCard, ProgressBar, formatDate, formatNumber } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function IndicatorDetailPage({ params }: { params: Promise<{ code: string }> }) {
  await requirePermission(PERMISSIONS.INDICATOR_READ);
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

  // Only the publications that actually produced this indicator's records.
  const lineage = await indicatorLineage(indicator.code, resolved.reportingPeriodId);
  const publications = lineage?.publications ?? [];

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
          value={
            lineage?.qualityStatus === "validated"
              ? "Validated"
              : lineage?.qualityStatus === "warnings"
                ? "With warnings"
                : "Not published"
          }
          sub={`last updated ${formatDate(lineage?.lastUpdated ?? performance?.last_calculated_at ?? null)}`}
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
            ["Traced to", lineage?.domain ? DOMAIN_LABELS[lineage.domain] : "Not mapped to a record set"],
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
        <h2 className="mb-1 text-sm font-semibold">Data lineage</h2>
        <p className="mb-3 text-xs text-[color:var(--color-ink-400)]">
          The published datasets whose records produce this figure. Dataset-level provenance only — no row-level
          beneficiary information is exposed.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Data source</th>
              <th>Period</th>
              <th className="text-right">Rows</th>
              <th className="text-right">Quality</th>
              <th className="text-right">Warnings</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {publications.map((publication) => (
              <tr key={publication.publicationRecordId}>
                <td className="font-medium">{publication.datasetName}</td>
                <td>{publication.dataSourceName}</td>
                <td>{publication.reportingPeriodCode}</td>
                <td className="text-right tabular-nums">{formatNumber(publication.publishedRowCount)}</td>
                <td className="text-right tabular-nums">
                  {publication.qualityScore === null ? "—" : formatNumber(publication.qualityScore, 1)}
                </td>
                <td className="text-right tabular-nums">
                  {publication.warningRowCount > 0 ? (
                    <Badge tone="warning">{formatNumber(publication.warningRowCount)}</Badge>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="whitespace-nowrap">{formatDate(publication.publishedAt)}</td>
              </tr>
            ))}
            {publications.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[color:var(--color-ink-400)]">
                  No published datasets yet contribute to this indicator.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
