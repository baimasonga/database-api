import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { KpiCard, formatDate, formatNumber } from "@/components/ui";
import { DuplicateReview } from "./review";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const user = await getCurrentUser();
  const [pending, confirmedCount, rejectedCount, merges, beneficiaryCount] = await Promise.all([
    prisma.duplicateCandidate.findMany({
      where: { status: "pending" },
      orderBy: [{ matchType: "asc" }, { score: "desc" }],
      take: 100,
      include: {
        primary: { select: { id: true, avdpReference: true, fullName: true, sex: true, phone: true } },
        candidate: { select: { id: true, avdpReference: true, fullName: true, sex: true, phone: true } },
      },
    }),
    prisma.duplicateCandidate.count({ where: { status: "merged" } }),
    prisma.duplicateCandidate.count({ where: { status: "rejected" } }),
    prisma.beneficiaryMerge.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        survivor: { select: { avdpReference: true, fullName: true } },
        merged: { select: { avdpReference: true, fullName: true } },
        reviewer: { select: { fullName: true } },
      },
    }),
    prisma.beneficiary.count({ where: { status: { not: "merged" } } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Beneficiary Identity</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Deterministic matches are linked automatically during publication. Probable matches always require human review
          before any records are merged, and merges never delete source lineage.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Canonical beneficiaries" value={formatNumber(beneficiaryCount)} />
        <KpiCard label="Potential duplicates" value={formatNumber(pending.length)} sub="awaiting review" />
        <KpiCard label="Confirmed merges" value={formatNumber(confirmedCount)} />
        <KpiCard label="Rejected matches" value={formatNumber(rejectedCount)} />
      </section>

      <DuplicateReview
        canMerge={user?.permissions.includes(PERMISSIONS.BENEFICIARY_MERGE) ?? false}
        candidates={pending.map((c) => ({
          id: c.id,
          matchType: c.matchType,
          ruleCode: c.ruleCode,
          score: Number(c.score),
          primary: c.primary,
          candidate: c.candidate,
        }))}
      />

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Merge history</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Surviving record</th>
              <th>Merged record</th>
              <th>Match</th>
              <th>Reviewer</th>
              <th>Decision</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {merges.map((merge) => (
              <tr key={merge.id}>
                <td>
                  {merge.survivor.fullName}{" "}
                  <span className="font-mono text-xs text-[color:var(--color-ink-400)]">{merge.survivor.avdpReference ?? ""}</span>
                </td>
                <td>
                  {merge.merged.fullName}{" "}
                  <span className="font-mono text-xs text-[color:var(--color-ink-400)]">{merge.merged.avdpReference ?? ""}</span>
                </td>
                <td className="text-xs">
                  {merge.matchType} · {merge.ruleCode ?? "—"}
                </td>
                <td>{merge.reviewer?.fullName ?? "system"}</td>
                <td className="max-w-xs text-xs">{merge.decision}</td>
                <td className="whitespace-nowrap">{formatDate(merge.createdAt)}</td>
              </tr>
            ))}
            {merges.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[color:var(--color-ink-400)]">
                  No merges recorded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
