import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getInfrastructureSummary } from "@/modules/analytics/queries";
import type { InfrastructureSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved }) => {
  const s = await getInfrastructureSummary(resolved);
  const payload: InfrastructureSummary = {
    assetCount: s.asset_count,
    completedCount: s.completed_count,
    ongoingCount: s.ongoing_count,
    beneficiariesServed: s.beneficiaries_served,
    byType: s.by_type.map((t) => ({
      assetType: t.asset_type,
      assetCount: t.asset_count,
      completedCount: t.completed_count,
    })),
  };
  return ok(payload, { filters: filtersToEnvelope(filters), reportingPeriod: resolved.reportingPeriodCode });
});
