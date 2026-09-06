import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parsePagination } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getDistrictSummaries } from "@/modules/analytics/queries";
import type { DistrictSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved, url }) => {
  const { page, page_size: pageSize } = parsePagination(url);
  const rows = await getDistrictSummaries(resolved);
  const mapped: DistrictSummary[] = rows.map((r) => ({
    id: r.district_id,
    code: r.district_code,
    name: r.district_name,
    latitude: r.latitude,
    longitude: r.longitude,
    beneficiaries: r.total_beneficiaries,
    female: r.female_count,
    areaHa: r.total_area_ha,
    participantsTrained: r.participants_trained,
    infrastructureAssets: r.infrastructure_assets,
  }));
  const start = (page - 1) * pageSize;
  return ok(mapped.slice(start, start + pageSize), {
    filters: filtersToEnvelope(filters),
    reportingPeriod: resolved.reportingPeriodCode,
    pagination: { page, pageSize, total: mapped.length },
  });
});
