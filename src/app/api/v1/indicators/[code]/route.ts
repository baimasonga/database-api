import { ApiError, ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parseFilters } from "@/lib/api/filters";
import { checkRateLimit, clientKey } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import { getIndicatorPerformance, resolveFilters } from "@/modules/analytics/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) return ApiError.rateLimited(limit.retryAfterSeconds);

  const { code } = await params;
  const url = new URL(request.url);
  const parsed = parseFilters(url);
  if (!parsed.success) return ApiError.badRequest("Invalid query parameters.", parsed.error.flatten().fieldErrors);

  try {
    const indicator = await prisma.indicator.findUnique({
      where: { code },
      include: { disaggregations: true, primaryDataSource: { select: { name: true, code: true } } },
    });
    if (!indicator) return ApiError.notFound(`Indicator "${code}" is not registered.`);

    const resolved = await resolveFilters(parsed.data);
    const performance = (await getIndicatorPerformance(resolved, code))[0] ?? null;

    return ok(
      {
        code: indicator.code,
        name: indicator.name,
        short_name: indicator.shortName,
        definition: indicator.definition,
        description: indicator.description,
        unit: indicator.unit,
        result_level: indicator.resultLevel,
        calculation_method: indicator.calculationMethod,
        calculation_version: indicator.calculationVersion,
        frequency: indicator.frequency,
        responsible_unit: indicator.responsibleUnit,
        primary_data_source: indicator.primaryDataSource?.name ?? null,
        disaggregations: indicator.disaggregations.map((d) => d.dimension),
        actual: performance?.actual_value ?? 0,
        target: performance?.target_value ?? null,
        achievement_percent: performance?.achievement_percent ?? null,
      },
      {
        filters: filtersToEnvelope(parsed.data),
        reportingPeriod: resolved.reportingPeriodCode,
        lastUpdated: performance?.last_calculated_at ?? null,
        calculationVersion: indicator.calculationVersion,
      },
    );
  } catch (error) {
    console.error("[api/v1] indicator detail", error);
    return ApiError.server();
  }
}
