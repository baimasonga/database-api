import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage() {
  const indicators = await prisma.indicator.findMany({
    orderBy: { code: "asc" },
    include: {
      primaryDataSource: { select: { name: true } },
      disaggregations: true,
      _count: { select: { targets: true, observations: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Indicator Registry</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Dashboard KPIs reference an indicator code (for example AVDP-OUT-001) rather than a number embedded in
          frontend code.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Result level</th>
              <th>Unit</th>
              <th>Frequency</th>
              <th>Responsible unit</th>
              <th>Primary source</th>
              <th>Disaggregation</th>
              <th className="text-right">Targets</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((indicator) => (
              <tr key={indicator.id}>
                <td className="font-mono text-xs">
                  <Link href={`/data-manager/indicators/${indicator.code}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {indicator.code}
                  </Link>
                </td>
                <td className="font-medium">{indicator.name}</td>
                <td className="capitalize">{indicator.resultLevel}</td>
                <td>{indicator.unit ?? "—"}</td>
                <td className="capitalize">{indicator.frequency.replace(/_/g, " ")}</td>
                <td>{indicator.responsibleUnit ?? "—"}</td>
                <td>{indicator.primaryDataSource?.name ?? "—"}</td>
                <td className="text-xs">{indicator.disaggregations.map((d) => d.dimension).join(", ") || "—"}</td>
                <td className="text-right tabular-nums">{formatNumber(indicator._count.targets)}</td>
                <td>
                  <Badge tone={indicator.isActive ? "success" : "neutral"}>{indicator.isActive ? "active" : "inactive"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[color:var(--color-ink-400)]">
        {indicators.length} registered indicators · registry last changed {formatDate(indicators[0]?.updatedAt)}
      </p>
    </div>
  );
}
