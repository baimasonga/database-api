import type { IndicatorLineage } from "@/data/types";
import { Badge, formatDate } from "./ui";

const QUALITY_LABEL: Record<IndicatorLineage["dataQualityStatus"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  validated: { label: "Validated", tone: "success" },
  warnings: { label: "Validated with warnings", tone: "warning" },
  unavailable: { label: "Not yet published", tone: "neutral" },
};

/**
 * Phase 15 "About this indicator" disclosure. Kept collapsed so the dashboard
 * stays uncluttered, and limited to dataset-level provenance.
 */
export function IndicatorLineagePanel({ lineage }: { lineage: IndicatorLineage | null }) {
  if (!lineage) return null;
  const quality = QUALITY_LABEL[lineage.dataQualityStatus];

  return (
    <details className="group mt-1">
      <summary className="cursor-pointer list-none text-xs font-medium text-[color:var(--color-avdp-700)] hover:underline">
        About this indicator
      </summary>
      <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-[color:var(--color-avdp-100)] pl-3 text-xs text-[color:var(--color-ink-600)]">
        {lineage.definition ? <p>{lineage.definition}</p> : null}
        <p>
          <span className="label">Source</span>{" "}
          {lineage.publications.length > 0
            ? [...new Set(lineage.publications.map((p) => p.dataSource))].join(" + ")
            : (lineage.primaryDataSource ?? "Not yet linked to a published dataset")}
        </p>
        <p>
          <span className="label">Reporting period</span> {lineage.reportingPeriod ?? "—"}
        </p>
        <p>
          <span className="label">Last updated</span> {formatDate(lineage.lastUpdated)}
        </p>
        <p className="flex items-center gap-2">
          <span className="label">Data quality</span> <Badge tone={quality.tone}>{quality.label}</Badge>
        </p>
        <p className="text-[color:var(--color-ink-400)]">
          Calculation v{lineage.calculationVersion} · {lineage.indicatorCode}
        </p>
      </div>
    </details>
  );
}
