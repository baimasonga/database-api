import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getProductionSummary } from "@/modules/analytics/queries";
import type { ProductionSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved }) => {
  const s = await getProductionSummary(resolved);
  const payload: ProductionSummary = {
    records: s.production_records,
    totalAreaHa: s.total_area_ha,
    totalQuantity: s.total_quantity,
    avgYieldPerHa: s.avg_yield_per_ha,
    producingBeneficiaries: s.producing_beneficiaries,
  };
  return ok(payload, { filters: filtersToEnvelope(filters), reportingPeriod: resolved.reportingPeriodCode });
});
