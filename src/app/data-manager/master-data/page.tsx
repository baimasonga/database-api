import { prisma } from "@/lib/db";
import { KpiCard, formatNumber } from "@/components/ui";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  await requirePermission(PERMISSIONS.SOURCE_READ);
  const [districts, valueChains, units, partners, organizations, lookupSets] = await Promise.all([
    prisma.district.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { chiefdoms: true } } } }),
    prisma.valueChain.findMany({ orderBy: { name: "asc" } }),
    prisma.unitOfMeasure.findMany({ orderBy: { code: "asc" } }),
    prisma.implementingPartner.count(),
    prisma.organization.count(),
    prisma.lookupSet.findMany({ include: { _count: { select: { values: true } } }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Master Data</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Master data doubles as the reference set for validation: a district added here is immediately accepted by the
          quality engine.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Districts" value={formatNumber(districts.length)} />
        <KpiCard label="Chiefdoms" value={formatNumber(districts.reduce((sum, d) => sum + d._count.chiefdoms, 0))} />
        <KpiCard label="Value chains" value={formatNumber(valueChains.length)} />
        <KpiCard label="Units of measure" value={formatNumber(units.length)} />
        <KpiCard label="Partners / organisations" value={formatNumber(partners + organizations)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold">Districts</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Province</th>
                <th className="text-right">Chiefdoms</th>
              </tr>
            </thead>
            <tbody>
              {districts.map((district) => (
                <tr key={district.id}>
                  <td className="font-mono text-xs">{district.code}</td>
                  <td>{district.name}</td>
                  <td>{district.province ?? "—"}</td>
                  <td className="text-right tabular-nums">{district._count.chiefdoms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Value chains</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {valueChains.map((vc) => (
                  <tr key={vc.id}>
                    <td className="font-mono text-xs">{vc.code}</td>
                    <td>{vc.name}</td>
                    <td>{vc.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-semibold">Controlled lookup sets</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Name</th>
                  <th className="text-right">Aliases</th>
                </tr>
              </thead>
              <tbody>
                {lookupSets.map((set) => (
                  <tr key={set.id}>
                    <td className="font-mono text-xs">{set.code}</td>
                    <td>{set.name}</td>
                    <td className="text-right tabular-nums">{set._count.values}</td>
                  </tr>
                ))}
                {lookupSets.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-[color:var(--color-ink-400)]">
                      No lookup sets configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
