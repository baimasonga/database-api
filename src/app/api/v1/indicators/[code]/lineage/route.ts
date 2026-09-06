import { ApiError, ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parseFilters } from "@/lib/api/filters";
import { checkRateLimit, clientKey } from "@/lib/api/rate-limit";
import { getIndicatorLineage, getIndicatorPerformance, resolveFilters } from "@/modules/analytics/queries";
import type { IndicatorLineage } from "@/data/types";

export const dynamic = "force-dynamic";

/**
 * Phase 15 lineage endpoint: explains where an indicator's number came from.
 * It exposes dataset- and source-level provenance only — never row-level
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
    const lineage = await getIndicatorLineage(code);
    if (!lineage) return ApiError.notFound(`Indicator "${code}" is not registered.`);

    const resolved = await resolveFilters(parsed.data);
    const performance = (await getIndicatorPerformance(resolved, code))[0] ?? null;
    const relevant = resolved.reportingPeriodId
      ? lineage.publications.filter((p) => p.reportingPeriodId === resolved.reportingPeriodId)
      : lineage.publications;

    const hasWarnings = relevant.some((p) => (p.importJob?.warningRowCount ?? 0) > 0);
    const payload: IndicatorLineage = {
      indicatorCode: lineage.indicator.code,
      indicatorName: lineage.indicator.name,
      definition: lineage.indicator.definition,
      calculationMethod: lineage.indicator.calculationMethod,
      calculationVersion: lineage.indicator.calculationVersion,
      reportingPeriod: resolved.reportingPeriodCode,
      lastUpdated: performance?.last_calculated_at ?? relevant[0]?.publishedAt.toISOString() ?? null,
      dataQualityStatus: relevant.length === 0 ? "unavailable" : hasWarnings ? "warnings" : "validated",
      primaryDataSource: lineage.indicator.primaryDataSource?.name ?? null,
      publications: relevant.map((p) => ({
        dataset: p.dataset.name,
        dataSource: p.dataset.dataSource.name,
        reportingPeriod: p.reportingPeriod.code,
        publishedAt: p.publishedAt.toISOString(),
        qualityScore: p.qualityScore ? Number(p.qualityScore) : null,
      })),
    };

    return ok(payload, {
      filters: filtersToEnvelope(parsed.data),
      reportingPeriod: resolved.reportingPeriodCode,
      lastUpdated: payload.lastUpdated,
      calculationVersion: lineage.indicator.calculationVersion,
    });
  } catch (error) {
    console.error("[api/v1] indicator lineage", error);
    return ApiError.server();
  }
}
