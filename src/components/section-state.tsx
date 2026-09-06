import type { ReactNode } from "react";
import type { SectionResult } from "@/data/dashboard-service";

/**
 * The four dashboard section states required by the live-data integration:
 * loading, empty, API error / data unavailable, and loaded.
 *
 * Sections render through <Section>, so every part of the dashboard handles
 * these states identically and no section can quietly show a wrong figure.
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[color:var(--color-avdp-100)] ${className}`} aria-hidden />;
}

export function KpiSkeleton() {
  return (
    <div className="card flex flex-col gap-2" aria-busy="true" aria-label="Loading indicator">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="h-8 w-32" />
      <SkeletonBlock className="h-3 w-40" />
    </div>
  );
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </section>
  );
}

export function PanelSkeleton({ rows = 5, title }: { rows?: number; title?: string }) {
  return (
    <div className="card" aria-busy="true" aria-label={title ? `Loading ${title}` : "Loading"}>
      {title ? <h2 className="mb-4 text-sm font-semibold">{title}</h2> : <SkeletonBlock className="mb-4 h-4 w-40" />}
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <SkeletonBlock className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** No published data matches the filters — distinct from "the value is zero". */
export function EmptySection({ title, reportingPeriod }: { title: string; reportingPeriod?: string | null }) {
  return (
    <div className="card border-dashed">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[color:var(--color-ink-600)]">
        No published data for the selected filters
        {reportingPeriod ? ` in ${reportingPeriod}` : ""}.
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-ink-400)]">
        Figures appear here once a dataset has been validated, approved and published in the AVDP Data Manager.
      </p>
    </div>
  );
}

/**
 * Live mode could not reach the analytics API. The section says so plainly
 * rather than showing a fictitious or stale figure.
 */
export function UnavailableSection({
  title,
  message,
  endpoint,
}: {
  title: string;
  message: string;
  endpoint?: string | null;
}) {
  return (
    <div className="card border-amber-200 bg-amber-50" role="status">
      <h2 className="text-sm font-semibold text-amber-900">{title}</h2>
      <p className="mt-1 text-sm text-amber-800">Data temporarily unavailable.</p>
      <p className="mt-1 text-xs text-amber-800">
        The dashboard is running in live mode and could not reach the analytics API. No substitute figures are shown.
      </p>
      {endpoint ? <p className="mt-2 break-all font-mono text-xs text-amber-700">{endpoint} — {message}</p> : null}
    </div>
  );
}

/**
 * Renders the right state for a section result. `children` runs only for a
 * successful, non-empty result, so it can index into data safely.
 */
export function Section<T>({
  title,
  result,
  children,
}: {
  title: string;
  result: SectionResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (result.status === "unavailable") {
    return <UnavailableSection title={title} message={result.message} endpoint={result.endpoint} />;
  }
  if (result.status === "empty") {
    return <EmptySection title={title} reportingPeriod={result.meta.reportingPeriod} />;
  }
  return <>{children(result.data)}</>;
}
