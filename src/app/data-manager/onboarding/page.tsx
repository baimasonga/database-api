import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ONBOARDING_DESCRIPTIONS,
  ONBOARDING_LABELS,
  ONBOARDING_STATUSES,
  statusRank,
  type OnboardingStatus,
} from "@/modules/governance/onboarding";
import { Badge, KpiCard, formatDate, formatNumber } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Onboarding pipeline for the existing AVDP data repositories (Phase 14).
 *
 * Shows how far each registered source and dataset has progressed, so a
 * migration can be tracked rather than guessed at. Status is advanced by the
 * ingestion lifecycle itself.
 */
export default async function OnboardingPage() {
  await requirePermission(PERMISSIONS.SOURCE_READ);
  const [sources, datasets] = await Promise.all([
    prisma.dataSource.findMany({
      where: { archivedAt: null },
      orderBy: [{ name: "asc" }],
      include: { _count: { select: { datasets: true, importJobs: true } } },
    }),
    prisma.dataset.findMany({
      where: { archivedAt: null },
      orderBy: [{ name: "asc" }],
      include: {
        dataSource: { select: { id: true, name: true } },
        _count: { select: { importJobs: true, publications: true } },
      },
    }),
  ]);

  const countsByStatus = (items: Array<{ onboardingStatus: OnboardingStatus }>) =>
    ONBOARDING_STATUSES.map((status) => ({
      status,
      count: items.filter((i) => i.onboardingStatus === status).length,
    }));

  const datasetCounts = countsByStatus(datasets);
  const maxCount = Math.max(1, ...datasetCounts.map((c) => c.count));
  const liveCount = datasets.filter((d) => d.onboardingStatus === "live").length;
  const notStarted = datasets.filter((d) => d.onboardingStatus === "discovered").length;
  const inProgress = datasets.length - liveCount - notStarted;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">
          Repository Onboarding
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Progress of existing AVDP data repositories through the onboarding process. Status advances as each dataset is
          profiled, mapped, validated, approved and published.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Registered sources" value={formatNumber(sources.length)} />
        <KpiCard label="Registered datasets" value={formatNumber(datasets.length)} />
        <KpiCard label="In progress" value={formatNumber(inProgress)} sub={`${formatNumber(notStarted)} not yet assessed`} />
        <KpiCard
          label="Live"
          value={formatNumber(liveCount)}
          sub={datasets.length > 0 ? `${Math.round((liveCount / datasets.length) * 100)}% of registered datasets` : undefined}
        />
      </section>

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold">Onboarding pipeline</h2>
        <p className="mb-4 text-xs text-[color:var(--color-ink-400)]">Datasets at each stage</p>
        <ol className="flex flex-col gap-2.5">
          {datasetCounts.map(({ status, count }) => (
            <li key={status} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{ONBOARDING_LABELS[status]}</span>
                <span className="tabular-nums text-[color:var(--color-ink-600)]">{formatNumber(count)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-avdp-100)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-avdp-600)]"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[color:var(--color-ink-400)]">{ONBOARDING_DESCRIPTIONS[status]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Datasets</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Source</th>
              <th>Domain</th>
              <th>Primary identifier</th>
              <th className="text-right">Imports</th>
              <th className="text-right">Publications</th>
              <th>Onboarding status</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((dataset) => (
              <tr key={dataset.id}>
                <td className="font-medium">{dataset.name}</td>
                <td>
                  <Link href={`/data-manager/sources/${dataset.dataSource.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {dataset.dataSource.name}
                  </Link>
                </td>
                <td className="capitalize">{dataset.domain}</td>
                <td className="font-mono text-xs">{dataset.primaryIdentifier ?? "—"}</td>
                <td className="text-right tabular-nums">{formatNumber(dataset._count.importJobs)}</td>
                <td className="text-right tabular-nums">{formatNumber(dataset._count.publications)}</td>
                <td>
                  <Badge tone={dataset.onboardingStatus === "live" ? "success" : "info"}>
                    {ONBOARDING_LABELS[dataset.onboardingStatus]}
                  </Badge>
                </td>
                <td className="text-xs text-[color:var(--color-ink-600)]">{nextStep(dataset.onboardingStatus)}</td>
              </tr>
            ))}
            {datasets.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                  No datasets registered. Use the inventory template and the bulk registration script to list what
                  exists before importing anything.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Sources</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Owning unit</th>
              <th>Repository location</th>
              <th>Personal data</th>
              <th className="text-right">Datasets</th>
              <th className="text-right">Imports</th>
              <th>Onboarding status</th>
              <th>Last received</th>
            </tr>
          </thead>
          <tbody>
            {[...sources]
              .sort((a, b) => statusRank(a.onboardingStatus) - statusRank(b.onboardingStatus) || a.name.localeCompare(b.name))
              .map((source) => (
                <tr key={source.id}>
                  <td>
                    <Link href={`/data-manager/sources/${source.id}`} className="font-medium text-[color:var(--color-avdp-700)] hover:underline">
                      {source.name}
                    </Link>
                  </td>
                  <td>{source.ownerUnit ?? "—"}</td>
                  <td className="max-w-xs truncate text-xs">{source.repositoryLocation ?? "—"}</td>
                  <td>{source.containsPersonalData ? <Badge tone="warning">Yes</Badge> : "No"}</td>
                  <td className="text-right tabular-nums">{source._count.datasets}</td>
                  <td className="text-right tabular-nums">{source._count.importJobs}</td>
                  <td>
                    <Badge tone={source.onboardingStatus === "live" ? "success" : "info"}>
                      {ONBOARDING_LABELS[source.onboardingStatus]}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(source.lastReceivedAt)}</td>
                </tr>
              ))}
            {sources.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[color:var(--color-ink-400)]">
                  No sources registered yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function nextStep(status: OnboardingStatus): string {
  switch (status) {
    case "discovered":
      return "Upload a sample so the schema can be profiled";
    case "assessed":
      return "Map columns to canonical AVDP fields";
    case "mapped":
      return "Run validation on a test import";
    case "tested":
      return "Resolve outstanding validation errors";
    case "validated":
      return "Submit for review and approval";
    case "approved":
      return "Publish to the analytics layer";
    case "live":
      return "Connect to an indicator, then maintain each period";
  }
}
