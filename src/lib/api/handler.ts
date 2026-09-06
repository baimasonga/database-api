import "server-only";
import type { NextResponse } from "next/server";
import { ApiError } from "./envelope";
import { checkRateLimit, clientKey } from "./rate-limit";
import { parseFilters, type DashboardFilters } from "./filters";
import { resolveFilters, type ResolvedFilters } from "@/modules/analytics/queries";

export interface ApiContext {
  filters: DashboardFilters;
  resolved: ResolvedFilters;
  url: URL;
}

/**
 * Wraps a /api/v1 handler with rate limiting, filter validation and uniform
 * error handling so every endpoint behaves identically.
 */
export function withApi(
  handler: (context: ApiContext) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    const limit = checkRateLimit(clientKey(request));
    if (!limit.allowed) return ApiError.rateLimited(limit.retryAfterSeconds);

    const url = new URL(request.url);
    const parsed = parseFilters(url);
    if (!parsed.success) {
      return ApiError.badRequest("Invalid query parameters.", parsed.error.flatten().fieldErrors);
    }

    try {
      const resolved = await resolveFilters(parsed.data);
      return await handler({ filters: parsed.data, resolved, url });
    } catch (error) {
      console.error("[api/v1]", url.pathname, error);
      return ApiError.server();
    }
  };
}
