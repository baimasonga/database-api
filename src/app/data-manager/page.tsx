import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, KpiCard, formatDate, formatNumber, statusTone } from "@/components/ui";
import { lastRefreshAt } from "@/modules/analytics/refresh";

export const dynamic = "force-dynamic";

/**
 * Data governance home screen. Deliberately scoped to dashboard-feed health:
 * no procurement, finance, HR or other operational modules belong here.
 */
export default async function DataManagerHome() {
  const currentPeriod = await prisma.reportingPeriod.findFirst({
    where: { status: "open" },
    orderBy: { startDate: "desc" },
  });

  const [
    sourceCount,
    activeSources,
    attentionSources,
    datasetCount,
    importsThisPeriod,
    pendingReview,
    pendingApproval,
    publishedCount,
    openErrors,
    recentImports,
    latestPublication,
    latestImport,
    qualityAgg,
    refreshedAt,
  ] = await Promise.all([
    prisma.dataSource.count({ where: { archivedAt: null } }),
    prisma.dataSource.count({ where: { archivedAt: null, status: "active" } }),
    prisma.dataSource.findMany({
      where: { archivedAt: null, status: "attention_required" },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.dataset.count({ where: { archivedAt: null } }),
    currentPeriod ? prisma.importJob.count({ where: { reportingPeriodId: currentPeriod.id } }) : Promise.resolve(0),
    prisma.importJob.count({ where: { status: "ready_for_review" } }),
    prisma.approvalRequest.findMany({
      where: { status: { in: ["pending", "in_review"] } },
      orderBy: { submittedAt: "asc" },
      take: 8,
      include: {
        importJob: {
          include: { dataset: true, dataSource: true, reportingPeriod: true },
        },
        requester: { select: { fullName: true } },
      },
    }),
    prisma.publicationRecord.count({ where: { status: "published" } }),
    prisma.validationResult.count({ where: { severity: "error", resolved: false } }),
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        dataset: { select: { name: true } },
        dataSource: { select: { name: true } },
        reportingPeriod: { select: { code: true } },
      },
    }),
    prisma.publicationRecord.findFirst({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      include: { dataset: { select: { name: true } } },
    }),
    prisma.importJob.findFirst({
      where: { status: { in: ["published", "approved"] } },
      orderBy: { updatedAt: "desc" },
      include: { dataset: { select: { name: true } } },
    }),
    prisma.importJob.aggregate({ _avg: { qualityScore: true } }),
    lastRefreshAt(),
  ]);

  const qualityScore = qualityAgg._avg.qualityScore ? Number(qualityAgg._avg.qualityScore) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">AVDP Data Manager</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Governance of the datasets feeding the AVDP dashboard
          {currentPeriod ? ` · current period ${currentPeriod.code}` : ""}
          {refreshedAt ? ` · analytics last refreshed ${formatDate(refreshedAt)}` : ""}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Data sources" value={formatNumber(sourceCount)} sub={`${formatNumber(activeSources)} active · ${attentionSources.length} need attention`} />
        <KpiCard label="Datasets" value={formatNumber(datasetCount)} sub={`${formatNumber(importsThisPeriod)} imports this period`} />
        <KpiCard
          label="Awaiting action"
          value={formatNumber(pendingReview + pendingApproval.length)}
          sub={`${formatNumber(pendingReview)} to submit · ${formatNumber(pendingApproval.length)} to approve`}
        />
        <KpiCard
          label="Data quality score"
          value={qualityScore === null ? "—" : formatNumber(qualityScore, 1)}
          unit={qualityScore === null ? undefined : "/ 100"}
          sub={`${formatNumber(publishedCount)} published datasets · ${formatNumber(openErrors)} unresolved errors`}
        />
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent imports</h2>
          <Link href="/data-manager/imports" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
            All imports
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source</th>
                <th>Period</th>
                <th className="text-right">Rows</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Warnings</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentImports.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/data-manager/imports/${job.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                      {job.dataset.name}
                    </Link>
                  </td>
                  <td>{job.dataSource.name}</td>
                  <td>{job.reportingPeriod.code}</td>
                  <td className="text-right tabular-nums">{formatNumber(job.rowCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(job.errorRowCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(job.warningRowCount)}</td>
                  <td>
                    <Badge tone={statusTone(job.status)}>{job.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(job.createdAt)}</td>
                </tr>
              ))}
              {recentImports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                    No imports yet. Register a data source, then upload a dataset.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Pending approvals</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {pendingApproval.map((request) => (
              <li key={request.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:var(--color-line)] pb-2 last:border-0">
                <div>
                  <Link href={`/data-manager/imports/${request.importJobId}`} className="font-medium text-[color:var(--color-avdp-700)] hover:underline">
                    {request.importJob.dataset.name}
                  </Link>
                  <p className="text-xs text-[color:var(--color-ink-600)]">
                    {request.importJob.dataSource.name} · {request.importJob.reportingPeriod.code} ·{" "}
                    {request.requester?.fullName ?? "unknown"} · {formatDate(request.submittedAt)}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <Badge tone={statusTone(request.status)}>{request.status.replace(/_/g, " ")}</Badge>
                  <p className="mt-1 text-[color:var(--color-ink-600)]">
                    score {request.qualityScore ? formatNumber(Number(request.qualityScore), 1) : "—"} ·{" "}
                    {formatNumber(request.errorCount)} err · {formatNumber(request.warningCount)} warn
                  </p>
                </div>
              </li>
            ))}
            {pendingApproval.length === 0 ? (
              <li className="text-[color:var(--color-ink-400)]">Nothing awaiting approval.</li>
            ) : null}
          </ul>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Data sources requiring attention</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {attentionSources.map((source) => (
                <li key={source.id} className="flex items-baseline justify-between gap-2">
                  <Link href={`/data-manager/sources/${source.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {source.name}
                  </Link>
                  <span className="text-xs text-[color:var(--color-ink-600)]">
                    last received {formatDate(source.lastReceivedAt)}
                  </span>
                </li>
              ))}
              {attentionSources.length === 0 ? (
                <li className="text-[color:var(--color-ink-400)]">All registered sources are healthy.</li>
              ) : null}
            </ul>
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Feed health</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-600)]">Latest successful import</dt>
                <dd className="text-right">
                  {latestImport ? `${latestImport.dataset.name} · ${formatDate(latestImport.updatedAt)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-600)]">Latest publication</dt>
                <dd className="text-right">
                  {latestPublication ? `${latestPublication.dataset.name} · ${formatDate(latestPublication.publishedAt)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-600)]">Unresolved validation errors</dt>
                <dd className="text-right tabular-nums">{formatNumber(openErrors)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
