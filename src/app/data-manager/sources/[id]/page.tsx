import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge, KpiCard, formatDate, formatNumber, statusTone } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DataSourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await prisma.dataSource.findUnique({
    where: { id },
    include: {
      datasets: { where: { archivedAt: null }, orderBy: { name: "asc" } },
      integrations: true,
      importJobs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { dataset: { select: { name: true } }, reportingPeriod: { select: { code: true } }, file: { select: { fileName: true } } },
      },
    },
  });
  if (!source) notFound();

  const [quality, auditTrail] = await Promise.all([
    prisma.importJob.aggregate({
      where: { dataSourceId: id },
      _sum: { rowCount: true, validRowCount: true, errorRowCount: true, warningRowCount: true },
      _avg: { qualityScore: true },
    }),
    prisma.auditLog.findMany({ where: { entityType: "data_source", entityId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const totalRows = quality._sum.rowCount ?? 0;
  const validRows = quality._sum.validRowCount ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/data-manager/sources" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
          ← Data Sources
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">{source.name}</h1>
          <Badge tone={statusTone(source.status)}>{source.status.replace(/_/g, " ")}</Badge>
          <Badge tone="info">{source.onboardingStatus}</Badge>
          {source.containsPersonalData ? <Badge tone="warning">Personal data</Badge> : null}
        </div>
        <p className="mt-1 font-mono text-xs text-[color:var(--color-ink-400)]">{source.code}</p>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Overview</h2>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          {[
            ["Description", source.description ?? "—"],
            ["Owning unit", source.ownerUnit ?? "—"],
            ["Source type", source.sourceType],
            ["Connection type", source.connectionType],
            ["Update frequency", source.frequency.replace(/_/g, " ")],
            ["Data classification", source.dataClassification],
            ["Responsible officer", source.contactPerson ?? "—"],
            ["Contact email", source.contactEmail ?? "—"],
            ["Repository location", source.repositoryLocation ?? "—"],
            ["Last data received", formatDate(source.lastReceivedAt)],
            ["Last successful import", formatDate(source.lastSuccessfulImportAt)],
            ["Last successful sync", formatDate(source.lastSuccessfulSyncAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="label">{label}</dt>
              <dd className="mt-0.5 capitalize">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Rows received" value={formatNumber(totalRows)} />
        <KpiCard label="Valid rows" value={formatNumber(validRows)} sub={totalRows > 0 ? `${Math.round((validRows / totalRows) * 100)}% pass rate` : undefined} />
        <KpiCard label="Rows with errors" value={formatNumber(quality._sum.errorRowCount ?? 0)} />
        <KpiCard label="Average quality score" value={quality._avg.qualityScore ? formatNumber(Number(quality._avg.qualityScore), 1) : "—"} />
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Datasets</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Code</th>
              <th>Domain</th>
              <th>Primary identifier</th>
              <th>Onboarding status</th>
            </tr>
          </thead>
          <tbody>
            {source.datasets.map((dataset) => (
              <tr key={dataset.id}>
                <td className="font-medium">{dataset.name}</td>
                <td className="font-mono text-xs">{dataset.code}</td>
                <td className="capitalize">{dataset.domain}</td>
                <td className="font-mono text-xs">{dataset.primaryIdentifier ?? "—"}</td>
                <td>
                  <Badge tone={statusTone(dataset.onboardingStatus)}>{dataset.onboardingStatus}</Badge>
                </td>
              </tr>
            ))}
            {source.datasets.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-[color:var(--color-ink-400)]">
                  No datasets registered for this source.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Import history</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Dataset</th>
                <th>Period</th>
                <th className="text-right">Rows</th>
                <th className="text-right">Errors</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {source.importJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link href={`/data-manager/imports/${job.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                      {job.file?.fileName ?? "—"}
                    </Link>
                  </td>
                  <td>{job.dataset.name}</td>
                  <td>{job.reportingPeriod.code}</td>
                  <td className="text-right tabular-nums">{formatNumber(job.rowCount)}</td>
                  <td className="text-right tabular-nums">{formatNumber(job.errorRowCount)}</td>
                  <td>
                    <Badge tone={statusTone(job.status)}>{job.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(job.createdAt)}</td>
                </tr>
              ))}
              {source.importJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-[color:var(--color-ink-400)]">
                    No imports recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Integration status</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {source.integrations.map((integration) => (
              <li key={integration.id} className="flex items-baseline justify-between gap-2">
                <span>
                  {integration.name}{" "}
                  <span className="text-xs text-[color:var(--color-ink-400)]">({integration.connectorType.replace(/_/g, " ")})</span>
                </span>
                <Badge tone={statusTone(integration.status)}>{integration.status}</Badge>
              </li>
            ))}
            {source.integrations.length === 0 ? (
              <li className="text-[color:var(--color-ink-400)]">No connector configured — data arrives by manual upload.</li>
            ) : null}
          </ul>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Audit history</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {auditTrail.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="font-medium">{entry.action}</span>{" "}
                  <span className="text-xs text-[color:var(--color-ink-600)]">{entry.actorEmail ?? "system"}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-[color:var(--color-ink-400)]">{formatDate(entry.createdAt)}</span>
              </li>
            ))}
            {auditTrail.length === 0 ? <li className="text-[color:var(--color-ink-400)]">No audit entries yet.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
