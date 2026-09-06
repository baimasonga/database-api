import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { formatDate } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.AUDIT_READ)) {
    return <p className="card text-sm text-red-700">You do not have permission to view audit logs.</p>;
  }

  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Audit Logs</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Every governance action is recorded: who did what, to which entity, and when.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Summary</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap text-xs">{formatDate(entry.createdAt)}</td>
                <td className="text-xs">{entry.actorEmail ?? "system"}</td>
                <td className="font-mono text-xs">{entry.action}</td>
                <td className="text-xs">
                  {entry.entityType}
                  {entry.entityId ? <span className="text-[color:var(--color-ink-400)]"> · {entry.entityId.slice(0, 8)}</span> : null}
                </td>
                <td className="max-w-md text-xs">{entry.summary ?? "—"}</td>
                <td className="font-mono text-xs">{entry.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[color:var(--color-ink-400)]">
                  No audit entries recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
