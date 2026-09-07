import { ApiError, ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parseFilters } from "@/lib/api/filters";
import { checkRateLimit, clientKey } from "@/lib/api/rate-limit";
import { resolveFilters } from "@/modules/analytics/queries";
import { DOMAIN_LABELS, indicatorLineage } from "@/modules/analytics/lineage";
import type { IndicatorLineage } from "@/data/types";

export const dynamic = "force-dynamic";

/**
 * Phase 15 lineage endpoint: explains where an indicator's number came from.
 *
 * Only publications that actually produced the indicator's records are
 * reported, traced through the calculation reference to the core table and its
 * originating import jobs. Provenance is dataset-level — never row-level
 * beneficiary information.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) return ApiError.rateLimited(limit.retryAfterSeconds);

  const { code } = await params;
  const url = new URL(request.url);
  const parsed = parseFilters(url);
  if (!parsed.success) return ApiError.badRequest("Invalid query parameters.", parsed.error.flatten().fieldErrors);

  try {
    const resolved = await resolveFilters(parsed.data);
    const lineage = await indicatorLineage(decodeURIComponent(code), resolved.reportingPeriodId);
    if (!lineage) return ApiError.notFound(`Indicator "${code}" is not registered.`);

    const payload: IndicatorLineage = {
      indicatorCode: lineage.indicator.code,
      indicatorName: lineage.indicator.name,
      definition: lineage.indicator.definition,
      calculationMethod: lineage.indicator.calculationMethod,
      calculationVersion: lineage.indicator.calculationVersion,
      reportingPeriod: resolved.reportingPeriodCode,
      lastUpdated: lineage.lastUpdated ? lineage.lastUpdated.toISOString() : null,
      dataQualityStatus: lineage.qualityStatus,
      // Prefer the sources that actually contributed over the registry's
      // nominal primary source, which can be stale or unset.
      primaryDataSource:
        lineage.dataSources.length > 0
          ? lineage.dataSources.join(" + ")
          : lineage.indicator.primaryDataSourceName,
      publications: lineage.publications.map((p) => ({
        dataset: p.datasetName,
        dataSource: p.dataSourceName,
        reportingPeriod: p.reportingPeriodCode,
        publishedAt: p.publishedAt.toISOString(),
        qualityScore: p.qualityScore,
      })),
    };

    return ok(payload, {
      filters: filtersToEnvelope(parsed.data),
      reportingPeriod: resolved.reportingPeriodCode,
      lastUpdated: payload.lastUpdated,
      calculationVersion: lineage.indicator.calculationVersion,
      headers: {
        // Names the record set behind the figure, for API consumers.
        "x-avdp-lineage-domain": lineage.domain ? DOMAIN_LABELS[lineage.domain] : "unmapped",
      },
    });
  } catch (error) {
    console.error("[api/v1] indicator lineage", error);
    return ApiError.server();
  }
}
