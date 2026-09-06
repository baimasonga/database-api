import { NextResponse } from "next/server";

/** Consistent response envelope for every /api/v1 endpoint. */
export interface ApiEnvelope<T> {
  data: T;
  metadata: {
    generated_at: string;
    source: "analytics";
    last_updated: string | null;
    reporting_period: string | null;
    calculation_version?: number;
    pagination?: { page: number; page_size: number; total: number; total_pages: number };
  };
  filters: Record<string, string | number | null>;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  metadata: { generated_at: string };
}

export function ok<T>(
  data: T,
  opts: {
    filters?: Record<string, string | number | null>;
    lastUpdated?: Date | string | null;
    reportingPeriod?: string | null;
    calculationVersion?: number;
    pagination?: { page: number; pageSize: number; total: number };
    headers?: Record<string, string>;
  } = {},
): NextResponse<ApiEnvelope<T>> {
  const lastUpdated =
    opts.lastUpdated instanceof Date ? opts.lastUpdated.toISOString() : (opts.lastUpdated ?? null);
  return NextResponse.json(
    {
      data,
      metadata: {
        generated_at: new Date().toISOString(),
        source: "analytics" as const,
        last_updated: lastUpdated,
        reporting_period: opts.reportingPeriod ?? null,
        ...(opts.calculationVersion !== undefined ? { calculation_version: opts.calculationVersion } : {}),
        ...(opts.pagination
          ? {
              pagination: {
                page: opts.pagination.page,
                page_size: opts.pagination.pageSize,
                total: opts.pagination.total,
                total_pages: Math.max(1, Math.ceil(opts.pagination.total / opts.pagination.pageSize)),
              },
            }
          : {}),
      },
      filters: opts.filters ?? {},
    },
    { headers: opts.headers },
  );
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) }, metadata: { generated_at: new Date().toISOString() } },
    { status },
  );
}

export const ApiError = {
  badRequest: (message: string, details?: unknown) => fail(400, "bad_request", message, details),
  unauthorized: () => fail(401, "unauthorized", "Authentication is required."),
  forbidden: (message = "You do not have permission to perform this action.") =>
    fail(403, "forbidden", message),
  notFound: (message = "Resource not found.") => fail(404, "not_found", message),
  conflict: (message: string, details?: unknown) => fail(409, "conflict", message, details),
  tooLarge: (message: string) => fail(413, "payload_too_large", message),
  rateLimited: (retryAfter: number) =>
    NextResponse.json(
      {
        error: { code: "rate_limited", message: "Too many requests." },
        metadata: { generated_at: new Date().toISOString() },
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    ),
  server: (message = "Unexpected server error.") => fail(500, "server_error", message),
};
