import type { QualityTrendPoint } from "@/modules/analytics/data-manager-home";
import { formatNumber } from "./ui";

/**
 * Data quality trend: validation pass rate by reporting period.
 *
 * One measure on one axis, one hue — colour encodes nothing beyond "this is
 * the measure", so there is no legend and no cycled palette. Labels are
 * selective (latest, best, worst); every column carries a hover breakdown and
 * the full numbers are available in the table view below.
 */

const TARGET_PASS_RATE = 95;

export function QualityTrend({ points }: { points: QualityTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="card">
        <h2 className="text-sm font-semibold">Data quality trend</h2>
        <p className="mt-2 text-sm text-[color:var(--color-ink-600)]">
          No imports have been validated yet.
        </p>
        <p className="mt-1 text-xs text-[color:var(--color-ink-400)]">
          The trend appears once datasets have been imported and validated across reporting periods.
        </p>
      </div>
    );
  }

  const rated = points.filter((p) => p.passRatePercent !== null);
  const best = rated.reduce<QualityTrendPoint | null>(
    (acc, p) => (acc === null || p.passRatePercent! > acc.passRatePercent! ? p : acc),
    null,
  );
  const worst = rated.reduce<QualityTrendPoint | null>(
    (acc, p) => (acc === null || p.passRatePercent! < acc.passRatePercent! ? p : acc),
    null,
  );
  const latest = points[points.length - 1];

  // Direct-label only the points that carry meaning; the rest are on hover.
  const labelled = new Set(
    [latest.periodId, best?.periodId, worst?.periodId].filter((id): id is string => !!id),
  );

  const previous = rated.length > 1 ? rated[rated.length - 2] : null;
  const change =
    latest.passRatePercent !== null && previous?.passRatePercent != null
      ? Math.round((latest.passRatePercent - previous.passRatePercent) * 10) / 10
      : null;

  return (
    <div className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Data quality trend</h2>
        <p className="text-xs text-[color:var(--color-ink-400)]">
          Validation pass rate by reporting period · target {TARGET_PASS_RATE}%
        </p>
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">
          {latest.passRatePercent === null ? "—" : `${latest.passRatePercent}%`}
        </span>
        <span className="text-xs text-[color:var(--color-ink-600)]">
          {latest.periodCode}
          {change === null ? "" : ` · ${change >= 0 ? "+" : ""}${change} pts vs previous period`}
        </span>
      </p>

      <div className="relative mt-4 h-40">
        {/* Target reference line, recessive and labelled in ink rather than colour. */}
        <div
          className="absolute inset-x-0 border-t border-dashed border-[color:var(--color-line)]"
          style={{ bottom: `${TARGET_PASS_RATE}%` }}
          aria-hidden
        >
          <span className="absolute -top-4 right-0 text-[10px] text-[color:var(--color-ink-400)]">
            target {TARGET_PASS_RATE}%
          </span>
        </div>

        <ol className="flex h-full items-end gap-[2px]" role="list">
          {points.map((point) => {
            const value = point.passRatePercent;
            const height = value === null ? 0 : Math.max(value, 1);
            const detail =
              value === null
                ? `${point.periodName}: no rows imported`
                : `${point.periodName}: ${value}% pass rate — ${formatNumber(point.validRows)} valid of ${formatNumber(point.totalRows)} rows, ${formatNumber(point.errorRows)} with errors, ${formatNumber(point.warningRows)} with warnings, across ${formatNumber(point.importCount)} import(s)`;

            return (
              <li key={point.periodId} className="flex h-full flex-1 flex-col justify-end" title={detail}>
                {labelled.has(point.periodId) && value !== null ? (
                  <span className="mb-1 text-center text-[10px] tabular-nums text-[color:var(--color-ink-600)]">
                    {value}%
                  </span>
                ) : null}
                <div
                  className="w-full rounded-t bg-[color:var(--color-avdp-600)]"
                  style={{ height: `${height}%` }}
                >
                  <span className="sr-only">{detail}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <ol className="mt-1.5 flex gap-[2px]" aria-hidden>
        {points.map((point) => (
          <li
            key={point.periodId}
            className="flex-1 truncate text-center text-[10px] text-[color:var(--color-ink-400)]"
          >
            {point.periodCode}
          </li>
        ))}
      </ol>

      <details className="mt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-[color:var(--color-avdp-700)] hover:underline">
          View as table
        </summary>
        <table className="table mt-2">
          <thead>
            <tr>
              <th>Period</th>
              <th className="text-right">Rows</th>
              <th className="text-right">Valid</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Warnings</th>
              <th className="text-right">Pass rate</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.periodId}>
                <td>{point.periodCode}</td>
                <td className="text-right tabular-nums">{formatNumber(point.totalRows)}</td>
                <td className="text-right tabular-nums">{formatNumber(point.validRows)}</td>
                <td className="text-right tabular-nums">{formatNumber(point.errorRows)}</td>
                <td className="text-right tabular-nums">{formatNumber(point.warningRows)}</td>
                <td className="text-right tabular-nums">
                  {point.passRatePercent === null ? "—" : `${point.passRatePercent}%`}
                </td>
                <td className="text-right tabular-nums">
                  {point.qualityScore === null ? "—" : formatNumber(point.qualityScore, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
