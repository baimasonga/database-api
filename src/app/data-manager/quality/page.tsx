import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, KpiCard, formatNumber } from "@/components/ui";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DataQualityPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const severity = one(params.severity);
  const sourceId = one(params.source);
  const periodId = one(params.period);

  const jobWhere = {
    ...(sourceId ? { dataSourceId: sourceId } : {}),
    ...(periodId ? { reportingPeriodId: periodId } : {}),
  };

  const [totals, findings, sources, periods, byCategory] = await Promise.all([
    prisma.importJob.aggregate({
      where: jobWhere,
      _sum: { rowCount: true, validRowCount: true, errorRowCount: true, warningRowCount: true, duplicateRowCount: true },
      _avg: { qualityScore: true },
    }),
    prisma.validationResult.findMany({
      where: {
        resolved: false,
        ...(severity && ["error", "warning", "info"].includes(severity) ? { severity: severity as never } : {}),
        importJob: jobWhere,
      },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 150,
      include: {
        importJob: {
          select: {
            id: true,
            dataset: { select: { name: true } },
            dataSource: { select: { name: true } },
            reportingPeriod: { select: { code: true } },
          },
        },
      },
    }),
    prisma.dataSource.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.reportingPeriod.findMany({ orderBy: { startDate: "desc" }, take: 12, select: { id: true, code: true } }),
    prisma.validationResult.groupBy({
      by: ["category"],
      where: { resolved: false, importJob: jobWhere },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),
  ]);

  const totalRows = totals._sum.rowCount ?? 0;
  const validRows = totals._sum.validRowCount ?? 0;
  const duplicateRows = totals._sum.duplicateRowCount ?? 0;
  const pct = (n: number) => (totalRows === 0 ? 0 : Math.round((n / totalRows) * 1000) / 10);

  const filterLink = (patch: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { severity, source: sourceId, period: periodId, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const qs = search.toString();
    return qs ? `/data-manager/quality?${qs}` : "/data-manager/quality";
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Data Quality</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Unresolved validation findings across all imports. Errors block publication; warnings require review.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total records" value={formatNumber(totalRows)} />
        <KpiCard label="Valid records" value={formatNumber(validRows)} sub={`${pct(validRows)}% validation pass rate`} />
        <KpiCard
          label="Records with issues"
          value={formatNumber((totals._sum.errorRowCount ?? 0) + (totals._sum.warningRowCount ?? 0))}
          sub={`${formatNumber(totals._sum.errorRowCount ?? 0)} errors · ${formatNumber(totals._sum.warningRowCount ?? 0)} warnings`}
        />
        <KpiCard
          label="Duplicate rate"
          value={`${pct(duplicateRows)}%`}
          sub={`average quality score ${totals._avg.qualityScore ? formatNumber(Number(totals._avg.qualityScore), 1) : "—"}`}
        />
      </section>

      <section className="card flex flex-wrap gap-6">
        <div>
          <span className="label">Severity</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[undefined, "error", "warning", "info"].map((value) => (
              <Link
                key={value ?? "all"}
                href={filterLink({ severity: value })}
                className={`badge border ${severity === value ? "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)]" : "border-[color:var(--color-line)] bg-white"}`}
              >
                {value ?? "All"}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Data source</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Link href={filterLink({ source: undefined })} className={`badge border ${sourceId ? "border-[color:var(--color-line)] bg-white" : "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)]"}`}>
              All
            </Link>
            {sources.map((source) => (
              <Link
                key={source.id}
                href={filterLink({ source: source.id })}
                className={`badge border ${sourceId === source.id ? "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)]" : "border-[color:var(--color-line)] bg-white"}`}
              >
                {source.name}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Reporting period</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Link href={filterLink({ period: undefined })} className={`badge border ${periodId ? "border-[color:var(--color-line)] bg-white" : "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)]"}`}>
              All
            </Link>
            {periods.map((period) => (
              <Link
                key={period.id}
                href={filterLink({ period: period.id })}
                className={`badge border ${periodId === period.id ? "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)]" : "border-[color:var(--color-line)] bg-white"}`}
              >
                {period.code}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Open findings by category</h2>
        <div className="flex flex-wrap gap-2">
          {byCategory.map((row) => (
            <Badge key={row.category} tone="neutral">
              {row.category.replace(/_/g, " ")}: {row._count._all}
            </Badge>
          ))}
          {byCategory.length === 0 ? <span className="text-sm text-[color:var(--color-ink-400)]">No open findings.</span> : null}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Issue review</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Import</th>
              <th>Source</th>
              <th>Period</th>
              <th>Row</th>
              <th>Field</th>
              <th>Rule</th>
              <th>Severity</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td>
                  <Link href={`/data-manager/imports/${finding.importJob.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {finding.importJob.dataset.name}
                  </Link>
                </td>
                <td>{finding.importJob.dataSource.name}</td>
                <td>{finding.importJob.reportingPeriod.code}</td>
                <td className="tabular-nums">{finding.rowNumber ?? "—"}</td>
                <td className="font-mono text-xs">{finding.fieldName ?? "—"}</td>
                <td className="font-mono text-xs">{finding.ruleCode}</td>
                <td>
                  <Badge tone={finding.severity === "error" ? "danger" : finding.severity === "warning" ? "warning" : "info"}>
                    {finding.severity}
                  </Badge>
                </td>
                <td className="max-w-md">{finding.message}</td>
              </tr>
            ))}
            {findings.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                  No unresolved findings for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
