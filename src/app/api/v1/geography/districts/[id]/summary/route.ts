import { ApiError, ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parseFilters } from "@/lib/api/filters";
import { checkRateLimit, clientKey } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import {
  getDistrictSummaries,
  getInfrastructureSummary,
  getProductionSummary,
  getTrainingSummary,
  resolveFilters,
} from "@/modules/analytics/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) return ApiError.rateLimited(limit.retryAfterSeconds);

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = parseFilters(url);
  if (!parsed.success) return ApiError.badRequest("Invalid query parameters.", parsed.error.flatten().fieldErrors);

  try {
    const district = await prisma.district.findFirst({
      where: { OR: [{ id }, { code: { equals: id, mode: "insensitive" } }] },
    });
    if (!district) return ApiError.notFound(`District "${id}" not found.`);

    const resolved = { ...(await resolveFilters(parsed.data)), districtId: district.id };
    const [rows, training, production, infrastructure] = await Promise.all([
      getDistrictSummaries(resolved),
      getTrainingSummary(resolved),
      getProductionSummary(resolved),
      getInfrastructureSummary(resolved),
    ]);
    const row = rows[0];

    return ok(
      {
        district: { id: district.id, code: district.code, name: district.name, province: district.province },
        beneficiaries: { total: row?.total_beneficiaries ?? 0, female: row?.female_count ?? 0 },
        training,
        production,
        infrastructure,
      },
      { filters: filtersToEnvelope(parsed.data), reportingPeriod: resolved.reportingPeriodCode },
    );
  } catch (error) {
    console.error("[api/v1] district summary", error);
    return ApiError.server();
  }
}
