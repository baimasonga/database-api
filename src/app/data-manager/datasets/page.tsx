import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber, statusTone } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  await requirePermission(PERMISSIONS.DATASET_READ);
  const datasets = await prisma.dataset.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    include: {
      dataSource: { select: { id: true, name: true } },
      _count: { select: { importJobs: true, versions: true, publications: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Datasets</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Each dataset belongs to one data source and maps onto one canonical AVDP domain.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Code</th>
              <th>Source</th>
              <th>Domain</th>
              <th>Owner</th>
              <th>Frequency</th>
              <th>Onboarding</th>
              <th className="text-right">Imports</th>
              <th className="text-right">Versions</th>
              <th className="text-right">Publications</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((dataset) => (
              <tr key={dataset.id}>
                <td className="font-medium">{dataset.name}</td>
                <td className="font-mono text-xs">{dataset.code}</td>
                <td>
                  <Link href={`/data-manager/sources/${dataset.dataSource.id}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {dataset.dataSource.name}
                  </Link>
                </td>
                <td className="capitalize">{dataset.domain}</td>
                <td>{dataset.ownerUnit ?? "—"}</td>
                <td className="capitalize">{dataset.frequency.replace(/_/g, " ")}</td>
                <td>
                  <Badge tone={statusTone(dataset.onboardingStatus)}>{dataset.onboardingStatus}</Badge>
                </td>
                <td className="text-right tabular-nums">{formatNumber(dataset._count.importJobs)}</td>
                <td className="text-right tabular-nums">{formatNumber(dataset._count.versions)}</td>
                <td className="text-right tabular-nums">{formatNumber(dataset._count.publications)}</td>
                <td className="whitespace-nowrap">{formatDate(dataset.updatedAt)}</td>
              </tr>
            ))}
            {datasets.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-[color:var(--color-ink-400)]">
                  No datasets registered yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
