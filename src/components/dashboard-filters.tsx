import Link from "next/link";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filters are expressed as links so the dashboard stays server-rendered and
 * shareable by URL. Identical filter semantics apply in mock and live mode.
 */
export function DashboardFilters({
  periods,
  districts,
  valueChains,
  active,
}: {
  periods: FilterOption[];
  districts: FilterOption[];
  valueChains: FilterOption[];
  active: { reporting_period?: string; district?: string; value_chain?: string };
}) {
  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...active, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  const group = (title: string, key: keyof typeof active, options: FilterOption[]) => (
    <div className="flex flex-col gap-1.5">
      <span className="label">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={href({ [key]: undefined })}
          className={`badge border ${active[key] ? "border-[color:var(--color-line)] bg-white" : "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)] text-[color:var(--color-avdp-800)]"}`}
        >
          All
        </Link>
        {options.map((option) => (
          <Link
            key={option.value}
            href={href({ [key]: option.value })}
            className={`badge border ${active[key] === option.value ? "border-[color:var(--color-avdp-600)] bg-[color:var(--color-avdp-100)] text-[color:var(--color-avdp-800)]" : "border-[color:var(--color-line)] bg-white"}`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card flex flex-col gap-4">
      {group("Reporting period", "reporting_period", periods)}
      {group("District", "district", districts)}
      {group("Value chain", "value_chain", valueChains)}
    </div>
  );
}
