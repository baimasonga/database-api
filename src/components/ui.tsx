import type { ReactNode } from "react";

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-sky-100 text-sky-800",
  gold: "bg-[color:var(--color-gold-100)] text-[color:var(--color-gold-600)]",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  return <span className={`badge ${BADGE_TONES[tone] ?? BADGE_TONES.neutral}`}>{children}</span>;
}

export function statusTone(status: string): keyof typeof BADGE_TONES {
  switch (status) {
    case "published":
    case "approved":
    case "active":
    case "live":
    case "succeeded":
      return "success";
    case "validation_failed":
    case "failed":
    case "rejected":
    case "attention_required":
      return "danger";
    case "ready_for_review":
    case "submitted":
    case "mapping_required":
    case "pending":
    case "in_review":
      return "warning";
    default:
      return "neutral";
  }
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  action,
}: {
  label: string;
  value: string;
  unit?: string | null;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {action}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">{value}</span>
        {unit ? <span className="text-sm text-[color:var(--color-ink-400)]">{unit}</span> : null}
      </div>
      {sub ? <div className="text-xs text-[color:var(--color-ink-600)]">{sub}</div> : null}
    </div>
  );
}

export function ProgressBar({ percent }: { percent: number | null }) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-avdp-100)]">
      <div
        className="h-full rounded-full bg-[color:var(--color-avdp-600)]"
        style={{ width: `${value}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function BarList({
  items,
  unit,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  unit?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="tabular-nums text-[color:var(--color-ink-600)]">
              {formatNumber(item.value)}
              {unit ? ` ${unit}` : ""}
              {item.hint ? <span className="ml-2 text-xs text-[color:var(--color-ink-400)]">{item.hint}</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-avdp-100)]">
            <div className="h-full rounded-full bg-[color:var(--color-avdp-500)]" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {items.length === 0 ? <li className="text-sm text-[color:var(--color-ink-400)]">No data for the selected filters.</li> : null}
    </ul>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-[color:var(--color-ink-600)]">{description}</p> : null}
    </div>
  );
}

/** Live-mode failure state. Mock values are never substituted here. */
export function DataUnavailable({ detail }: { detail?: string }) {
  return (
    <div className="card border-amber-200 bg-amber-50">
      <p className="font-medium text-amber-900">Data temporarily unavailable.</p>
      <p className="mt-1 text-sm text-amber-800">
        The AVDP dashboard is running in live mode and could not reach the analytics API. No substitute figures are shown.
      </p>
      {detail ? <p className="mt-2 font-mono text-xs text-amber-700">{detail}</p> : null}
    </div>
  );
}
