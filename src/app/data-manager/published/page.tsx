import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";
import { Badge, formatDate, formatNumber, statusTone } from "@/components/ui";
import { RefreshAnalyticsButton } from "./refresh-button";

export const dynamic = "force-dynamic";

export default async function PublishedDataPage() {
  await requirePermission(PERMISSIONS.IMPORT_READ);
  const [user, publications, refreshLog] = await Promise.all([
    getCurrentUser(),
    prisma.publicationRecord.findMany({
      orderBy: { publishedAt: "desc" },
      take: 100,
      include: {
        dataset: { include: { dataSource: { select: { name: true } } } },
        reportingPeriod: { select: { code: true } },
        publisher: { select: { fullName: true } },
      },
    }),
    prisma.analyticsRefreshLog.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Published Data</h1>
          <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
            The dashboard reads only from these publications. Superseded publications are retained, never deleted.
          </p>
        </div>
        {user?.permissions.includes(PERMISSIONS.ANALYTICS_REFRESH) ? <RefreshAnalyticsButton /> : null}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Source</th>
              <th>Reporting period</th>
              <th className="text-right">Rows</th>
              <th className="text-right">Quality</th>
              <th>Status</th>
              <th>Published by</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {publications.map((publication) => (
              <tr key={publication.id}>
                <td>
                  <Link href={`/data-manager/imports/${publication.importJobId}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {publication.dataset.name}
                  </Link>
                </td>
                <td>{publication.dataset.dataSource.name}</td>
                <td>{publication.reportingPeriod.code}</td>
                <td className="text-right tabular-nums">{formatNumber(publication.publishedRowCount)}</td>
                <td className="text-right tabular-nums">{publication.qualityScore ? formatNumber(Number(publication.qualityScore), 1) : "—"}</td>
                <td>
                  <Badge tone={statusTone(publication.status)}>{publication.status}</Badge>
                </td>
                <td>{publication.publisher?.fullName ?? "—"}</td>
                <td className="whitespace-nowrap">{formatDate(publication.publishedAt)}</td>
              </tr>
            ))}
            {publications.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                  Nothing published yet — the dashboard remains on mock data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Analytics refresh log</h2>
        <table className="table">
          <thead>
            <tr>
              <th>View</th>
              <th>Trigger</th>
              <th>Status</th>
              <th className="text-right">Rows</th>
              <th className="text-right">Duration</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {refreshLog.map((entry) => (
              <tr key={entry.id}>
                <td className="font-mono text-xs">{entry.viewName}</td>
                <td className="capitalize">{entry.trigger}</td>
                <td>
                  <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
                </td>
                <td className="text-right tabular-nums">{entry.rowCount === null ? "—" : formatNumber(entry.rowCount)}</td>
                <td className="text-right tabular-nums">{entry.durationMs === null ? "—" : `${entry.durationMs} ms`}</td>
                <td className="whitespace-nowrap">{formatDate(entry.startedAt)}</td>
              </tr>
            ))}
            {refreshLog.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[color:var(--color-ink-400)]">
                  The analytics layer has not been refreshed yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
