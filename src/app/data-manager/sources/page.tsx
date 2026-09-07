import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, KpiCard, formatDate, formatNumber, statusTone } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function DataSourcesPage() {
  await requirePermission(PERMISSIONS.SOURCE_READ);
  const currentPeriod = await prisma.reportingPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
  const [sources, datasetCount, importsThisPeriod] = await Promise.all([
    prisma.dataSource.findMany({
      where: { archivedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { _count: { select: { datasets: true, importJobs: true } } },
    }),
    prisma.dataset.count({ where: { archivedAt: null } }),
    currentPeriod ? prisma.importJob.count({ where: { reportingPeriodId: currentPeriod.id } }) : Promise.resolve(0),
  ]);

  const active = sources.filter((s) => s.status === "active").length;
  const attention = sources.filter((s) => s.status === "attention_required").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Data Sources</h1>
          <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">Where AVDP data originates.</p>
        </div>
        <Link href="/data-manager/sources/new" className="btn-primary">
          Register data source
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total data sources" value={formatNumber(sources.length)} />
        <KpiCard label="Active sources" value={formatNumber(active)} />
        <KpiCard label="Requiring attention" value={formatNumber(attention)} />
        <KpiCard label="Datasets received" value={formatNumber(datasetCount)} />
        <KpiCard label="Imports this period" value={formatNumber(importsThisPeriod)} sub={currentPeriod?.code ?? "no open period"} />
      </section>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Owning unit</th>
              <th>Type</th>
              <th>Connection</th>
              <th>Frequency</th>
              <th>Classification</th>
              <th>Status</th>
              <th>Last received</th>
              <th className="text-right">Datasets</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <Link href={`/data-manager/sources/${source.id}`} className="font-medium text-[color:var(--color-avdp-700)] hover:underline">
                    {source.name}
                  </Link>
                </td>
                <td className="font-mono text-xs">{source.code}</td>
                <td>{source.ownerUnit ?? "—"}</td>
                <td className="capitalize">{source.sourceType}</td>
                <td className="capitalize">{source.connectionType}</td>
                <td className="capitalize">{source.frequency.replace(/_/g, " ")}</td>
                <td className="capitalize">{source.dataClassification}</td>
                <td>
                  <Badge tone={statusTone(source.status)}>{source.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="whitespace-nowrap">{formatDate(source.lastReceivedAt)}</td>
                <td className="text-right tabular-nums">{source._count.datasets}</td>
              </tr>
            ))}
            {sources.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-[color:var(--color-ink-400)]">
                  No data sources registered yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
