import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import {
  getBeneficiarySummary,
  getIndicatorPerformance,
  getInfrastructureSummary,
  getProductionSummary,
  getTrainingSummary,
} from "@/modules/analytics/queries";
import { lastRefreshAt } from "@/modules/analytics/refresh";
import type { DashboardSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved }) => {
  const [beneficiaries, training, production, infrastructure, indicators, refreshedAt] = await Promise.all([
    getBeneficiarySummary(resolved),
    getTrainingSummary(resolved),
    getProductionSummary(resolved),
    getInfrastructureSummary(resolved),
    getIndicatorPerformance(resolved),
    lastRefreshAt(),
  ]);

  const payload: DashboardSummary = {
    beneficiaries: {
      total: beneficiaries.total_beneficiaries,
      female: beneficiaries.female_count,
      male: beneficiaries.male_count,
      youth: beneficiaries.youth_count,
      femaleSharePercent: beneficiaries.female_share_percent,
      districtsCovered: beneficiaries.districts_covered,
    },
    training: {
      participantsTrained: training.participants_trained,
      trainingEvents: training.training_events,
      certified: training.certified_count,
    },
    production: {
      totalAreaHa: production.total_area_ha,
      totalQuantity: production.total_quantity,
      avgYieldPerHa: production.avg_yield_per_ha,
    },
    infrastructure: {
      assetCount: infrastructure.asset_count,
      completedCount: infrastructure.completed_count,
      beneficiariesServed: infrastructure.beneficiaries_served,
    },
    headlineIndicators: indicators.slice(0, 6).map((i) => ({
      code: i.indicator_code,
      name: i.indicator_name,
      shortName: null,
      unit: i.unit,
      resultLevel: i.result_level,
      actual: i.actual_value,
      target: i.target_value,
      achievementPercent: i.achievement_percent,
      lastUpdated: i.last_calculated_at,
    })),
  };

  return ok(payload, {
    filters: filtersToEnvelope(filters),
    lastUpdated: beneficiaries.last_published_at ?? refreshedAt,
    reportingPeriod: resolved.reportingPeriodCode,
  });
});
