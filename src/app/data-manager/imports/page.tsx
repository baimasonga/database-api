import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      dataSource: { select: { name: true } },
      dataset: { select: { name: true } },
      reportingPeriod: { select: { code: true } },
      file: { select: { fileName: true, sizeBytes: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Imports</h1>
          <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
            CSV and Excel datasets landed in the raw layer, with their validation state.
          </p>
        </div>
        <Link href="/data-manager/imports/new" className="btn-primary">
          New import
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Source</th>
              <th>Dataset</th>
              <th>Period</th>
              <th className="text-right">Rows</th>
              <th className="text-right">Cols</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Warnings</th>
              <th className="text-right">Score</th>
              <th>Status</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <Link href={`/data-manager/imports/${job.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {job.file?.fileName ?? job.id.slice(0, 8)}
                  </Link>
                </td>
                <td>{job.dataSource.name}</td>
                <td>{job.dataset.name}</td>
                <td>{job.reportingPeriod.code}</td>
                <td className="text-right tabular-nums">{formatNumber(job.rowCount)}</td>
                <td className="text-right tabular-nums">{formatNumber(job.columnCount)}</td>
                <td className="text-right tabular-nums">{formatNumber(job.errorRowCount)}</td>
                <td className="text-right tabular-nums">{formatNumber(job.warningRowCount)}</td>
                <td className="text-right tabular-nums">{job.qualityScore ? formatNumber(Number(job.qualityScore), 1) : "—"}</td>
                <td>
                  <Badge tone={statusTone(job.status)}>{job.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="whitespace-nowrap">{formatDate(job.createdAt)}</td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-[color:var(--color-ink-400)]">
                  No imports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
