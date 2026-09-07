import Link from "next/link";
import { loadDataManagerHome } from "@/modules/analytics/data-manager-home";
import { QualityTrend } from "@/components/quality-trend";
import { Badge, KpiCard, formatDate, formatNumber, statusTone } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Data governance home screen. Deliberately scoped to dashboard-feed health:
 * no procurement, finance, HR or other operational modules belong here.
 */
export default async function DataManagerHome() {
  await requirePermission(PERMISSIONS.SOURCE_READ);
  const home = await loadDataManagerHome();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">AVDP Data Manager</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Governance of the datasets feeding the AVDP dashboard
          {home.currentPeriod ? ` · current period ${home.currentPeriod.code}` : ""}
          {home.refreshedAt ? ` · analytics last refreshed ${formatDate(home.refreshedAt)}` : ""}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Data sources"
          value={formatNumber(home.sourceCount)}
          sub={`${formatNumber(home.activeSourceCount)} active · ${formatNumber(home.attentionSourceCount)} need attention`}
        />
        <KpiCard
          label="Datasets"
          value={formatNumber(home.datasetCount)}
          sub={`${formatNumber(home.importsThisPeriod)} imports this period`}
        />
        <KpiCard
          label="Awaiting action"
          value={formatNumber(home.pendingReviewCount + home.pendingApprovalCount)}
          sub={`${formatNumber(home.pendingReviewCount)} to submit · ${formatNumber(home.pendingApprovalCount)} to approve`}
        />
        <KpiCard
          label="Data quality score"
          value={home.qualityScore === null ? "—" : formatNumber(home.qualityScore, 1)}
          unit={home.qualityScore === null ? undefined : "/ 100"}
          sub={`${formatNumber(home.publishedDatasetCount)} published datasets · ${formatNumber(home.openErrorCount)} unresolved errors`}
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
              {home.recentImports.map((job) => (
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
              {home.recentImports.length === 0 ? (
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
        <QualityTrend points={home.trend} />

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pending approvals</h2>
            {home.pendingApprovalCount > home.pendingApprovals.length ? (
              <Link href="/data-manager/approvals" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
                All {formatNumber(home.pendingApprovalCount)}
              </Link>
            ) : null}
          </div>
          <ul className="flex flex-col gap-3 text-sm">
            {home.pendingApprovals.map((request) => (
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
            {home.pendingApprovals.length === 0 ? (
              <li className="text-[color:var(--color-ink-400)]">Nothing awaiting approval.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Data sources requiring attention</h2>
            {home.attentionSourceCount > home.attentionSources.length ? (
              <Link href="/data-manager/sources" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
                All {formatNumber(home.attentionSourceCount)}
              </Link>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {home.attentionSources.map((source) => (
              <li key={source.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/data-manager/sources/${source.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                  {source.name}
                </Link>
                <span className="text-xs text-[color:var(--color-ink-600)]">
                  last received {formatDate(source.lastReceivedAt)}
                </span>
              </li>
            ))}
            {home.attentionSources.length === 0 ? (
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
                {home.latestImport ? `${home.latestImport.dataset.name} · ${formatDate(home.latestImport.updatedAt)}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--color-ink-600)]">Latest publication</dt>
              <dd className="text-right">
                {home.latestPublication
                  ? `${home.latestPublication.dataset.name} · ${formatDate(home.latestPublication.publishedAt)}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--color-ink-600)]">Published datasets</dt>
              <dd className="text-right tabular-nums">{formatNumber(home.publishedDatasetCount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--color-ink-600)]">Pending review</dt>
              <dd className="text-right tabular-nums">{formatNumber(home.pendingReviewCount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--color-ink-600)]">Unresolved validation errors</dt>
              <dd className="text-right tabular-nums">{formatNumber(home.openErrorCount)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
