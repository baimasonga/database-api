import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { Badge, formatDate, formatNumber } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  const user = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.ADMIN_MANAGE)) {
    return <p className="card text-sm text-red-700">You do not have permission to view administration settings.</p>;
  }

  const [users, roles, validationRules] = await Promise.all([
    prisma.user.findMany({ orderBy: { fullName: "asc" }, include: { roles: { include: { role: true } } } }),
    prisma.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { permissions: true, users: true } } } }),
    prisma.validationRule.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Administration</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Users, roles and platform configuration.
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Users</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Unit</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.unit ?? "—"}</td>
                <td className="text-xs">{u.roles.map((r) => r.role.name).join(", ") || "—"}</td>
                <td>
                  <Badge tone={u.status === "active" ? "success" : "neutral"}>{u.status}</Badge>
                </td>
                <td className="whitespace-nowrap">{formatDate(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Roles and permissions</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Code</th>
                <th className="text-right">Permissions</th>
                <th className="text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="font-medium">{role.name}</td>
                  <td className="font-mono text-xs">{role.code}</td>
                  <td className="text-right tabular-nums">{role._count.permissions}</td>
                  <td className="text-right tabular-nums">{role._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Platform configuration</h2>
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ["Dashboard data mode", env.dataMode()],
              ["Upload size limit", `${Math.floor(env.uploadMaxBytes() / (1024 * 1024))} MB`],
              ["Allowed upload types", env.uploadAllowedExtensions().join(", ")],
              ["API rate limit", `${env.apiRateLimit()} requests / ${env.apiRateWindowSeconds()}s`],
              ["Session lifetime", `${env.sessionTtlHours()} hours`],
              ["Beneficiary reference format", env.beneficiaryRefFormat()],
              ["Custom validation rules", formatNumber(validationRules)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-600)]">{label}</dt>
                <dd className="text-right font-mono text-xs">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-[color:var(--color-ink-400)]">
            Configuration is environment-driven. Database credentials and integration secrets are never exposed to the
            browser.
          </p>
        </div>
      </section>
    </div>
  );
}
