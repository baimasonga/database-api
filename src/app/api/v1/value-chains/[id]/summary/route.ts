import { ApiError, ok } from "@/lib/api/envelope";
import { filtersToEnvelope, parseFilters } from "@/lib/api/filters";
import { checkRateLimit, clientKey } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/db";
import {
  getProductionSummary,
  getTrainingSummary,
  getValueChainSummaries,
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
    const valueChain = await prisma.valueChain.findFirst({
      where: { OR: [{ id }, { code: { equals: id, mode: "insensitive" } }] },
    });
    if (!valueChain) return ApiError.notFound(`Value chain "${id}" not found.`);

    const resolved = { ...(await resolveFilters(parsed.data)), valueChainId: valueChain.id };
    const [rows, training, production] = await Promise.all([
      getValueChainSummaries(resolved),
      getTrainingSummary(resolved),
      getProductionSummary(resolved),
    ]);
    const row = rows[0];

    return ok(
      {
        value_chain: { id: valueChain.id, code: valueChain.code, name: valueChain.name, category: valueChain.category },
        beneficiaries: row?.total_beneficiaries ?? 0,
        training,
        production,
      },
      { filters: filtersToEnvelope(parsed.data), reportingPeriod: resolved.reportingPeriodCode },
    );
  } catch (error) {
    console.error("[api/v1] value chain summary", error);
    return ApiError.server();
  }
}
