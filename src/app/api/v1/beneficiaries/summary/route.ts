import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getBeneficiarySummary } from "@/modules/analytics/queries";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved }) => {
  const summary = await getBeneficiarySummary(resolved);
  return ok(summary, {
    filters: filtersToEnvelope(filters),
    reportingPeriod: resolved.reportingPeriodCode,
    lastUpdated: summary.last_published_at,
  });
});
