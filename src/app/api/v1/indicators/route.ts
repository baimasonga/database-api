import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parsePagination } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getIndicatorPerformance } from "@/modules/analytics/queries";
import { prisma } from "@/lib/db";
import type { IndicatorPerformance } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved, url }) => {
  const { page, page_size: pageSize } = parsePagination(url);
  const [performance, registry] = await Promise.all([
    getIndicatorPerformance(resolved),
    prisma.indicator.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  const byCode = new Map(performance.map((p) => [p.indicator_code, p]));
  const rows: IndicatorPerformance[] = registry.map((indicator) => {
    const actualRow = byCode.get(indicator.code);
    return {
      code: indicator.code,
      name: indicator.name,
      shortName: indicator.shortName,
      unit: indicator.unit,
      resultLevel: indicator.resultLevel,
      actual: actualRow?.actual_value ?? 0,
      target: actualRow?.target_value ?? null,
      achievementPercent: actualRow?.achievement_percent ?? null,
      lastUpdated: actualRow?.last_calculated_at ?? null,
    };
  });

  const start = (page - 1) * pageSize;
  return ok(rows.slice(start, start + pageSize), {
    filters: filtersToEnvelope(filters),
    reportingPeriod: resolved.reportingPeriodCode,
    lastUpdated: rows.map((r) => r.lastUpdated).filter(Boolean).sort().at(-1) ?? null,
    pagination: { page, pageSize, total: rows.length },
  });
});
