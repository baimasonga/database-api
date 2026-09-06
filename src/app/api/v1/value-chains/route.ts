import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parsePagination } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getValueChainSummaries } from "@/modules/analytics/queries";
import type { ValueChainSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved, url }) => {
  const { page, page_size: pageSize } = parsePagination(url);
  const rows = await getValueChainSummaries(resolved);
  const mapped: ValueChainSummary[] = rows.map((r) => ({
    id: r.value_chain_id,
    code: r.value_chain_code,
    name: r.value_chain_name,
    beneficiaries: r.total_beneficiaries,
    areaHa: r.total_area_ha,
    quantity: r.total_quantity,
    avgYieldPerHa: r.avg_yield_per_ha,
    participantsTrained: r.participants_trained,
  }));
  const start = (page - 1) * pageSize;
  return ok(mapped.slice(start, start + pageSize), {
    filters: filtersToEnvelope(filters),
    reportingPeriod: resolved.reportingPeriodCode,
    pagination: { page, pageSize, total: mapped.length },
  });
});
