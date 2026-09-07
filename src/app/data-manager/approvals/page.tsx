import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, formatDate, formatNumber, statusTone } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requirePermission(PERMISSIONS.IMPORT_READ);
  const requests = await prisma.approvalRequest.findMany({
    where: { status: { in: ["pending", "in_review", "returned"] } },
    orderBy: { submittedAt: "asc" },
    include: {
      importJob: { include: { dataset: true, dataSource: true, reportingPeriod: true } },
      requester: { select: { fullName: true, email: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Pending Approvals</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Datasets with unresolved validation errors cannot be approved or published.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Source</th>
              <th>Reporting period</th>
              <th>Submitted by</th>
              <th>Submission date</th>
              <th className="text-right">Quality score</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Warnings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link href={`/data-manager/imports/${request.importJobId}`} className="text-[color:var(--color-avdp-700)] hover:underline">
                    {request.importJob.dataset.name}
                  </Link>
                </td>
                <td>{request.importJob.dataSource.name}</td>
                <td>{request.importJob.reportingPeriod.code}</td>
                <td>{request.requester?.fullName ?? "—"}</td>
                <td className="whitespace-nowrap">{formatDate(request.submittedAt)}</td>
                <td className="text-right tabular-nums">{request.qualityScore ? formatNumber(Number(request.qualityScore), 1) : "—"}</td>
                <td className="text-right tabular-nums">{formatNumber(request.errorCount)}</td>
                <td className="text-right tabular-nums">{formatNumber(request.warningCount)}</td>
                <td>
                  <Badge tone={statusTone(request.status)}>{request.status.replace(/_/g, " ")}</Badge>
                </td>
              </tr>
            ))}
            {requests.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-[color:var(--color-ink-400)]">
                  Nothing is awaiting review or approval.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
