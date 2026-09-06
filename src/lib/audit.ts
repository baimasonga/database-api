import "server-only";
import { prisma } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth/session";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  changes?: unknown;
}

/**
 * Records an audit trail entry. Audit writes must never break the operation
 * they describe, so failures are logged rather than thrown.
 */
export async function recordAudit(
  actor: AuthenticatedUser | null,
  entry: AuditEntry,
  request?: Request,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
        changes: entry.changes === undefined ? undefined : JSON.parse(JSON.stringify(entry.changes)),
        ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: request?.headers.get("user-agent") ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry.action, error);
  }
}
