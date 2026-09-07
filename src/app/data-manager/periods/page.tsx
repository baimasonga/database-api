import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ReportingPeriodsPage() {
  await requirePermission(PERMISSIONS.SOURCE_READ);
  const periods = await prisma.reportingPeriod.findMany({
    orderBy: [{ fiscalYear: "desc" }, { startDate: "desc" }],
    include: { _count: { select: { importJobs: true, publications: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Reporting Periods</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Every import is bound to a reporting period; locked periods reject new uploads.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Fiscal year</th>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              <th className="text-right">Imports</th>
              <th className="text-right">Publications</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="font-mono text-xs">{period.code}</td>
                <td>{period.name}</td>
                <td className="capitalize">{period.periodType}</td>
                <td className="tabular-nums">{period.fiscalYear}</td>
                <td className="whitespace-nowrap">{formatDate(period.startDate)}</td>
                <td className="whitespace-nowrap">{formatDate(period.endDate)}</td>
                <td>
                  <Badge tone={period.status === "open" ? "success" : period.status === "locked" ? "danger" : "neutral"}>
                    {period.status}
                  </Badge>
                </td>
                <td className="text-right tabular-nums">{formatNumber(period._count.importJobs)}</td>
                <td className="text-right tabular-nums">{formatNumber(period._count.publications)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
