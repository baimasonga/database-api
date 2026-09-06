import { SiteHeader } from "@/components/site-header";
import { KpiRowSkeleton, PanelSkeleton, SkeletonBlock } from "@/components/section-state";

/** Route-level loading state, matching the dashboard's layout so the page does
 *  not shift when the real sections stream in. */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <SiteHeader current="dashboard" />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8" aria-busy="true">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">
              AVDP Performance Dashboard
            </h1>
            <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
              Agricultural Value Chain Development Project — Sierra Leone
            </p>
          </div>
          <SkeletonBlock className="h-3 w-72" />
        </div>

        <PanelSkeleton rows={3} title="Filters" />
        <KpiRowSkeleton />

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PanelSkeleton rows={6} title="Indicator performance against target" />
          </div>
          <PanelSkeleton rows={6} title="Beneficiaries by value chain" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <PanelSkeleton rows={8} title="Geographic coverage" />
          <PanelSkeleton rows={6} title="Infrastructure by asset type" />
        </section>
      </main>
    </div>
  );
}
