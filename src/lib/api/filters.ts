import { z } from "zod";

/** Query filters shared by the dashboard API surface. */
export const dashboardFilterSchema = z.object({
  reporting_period: z.string().trim().min(1).max(32).optional(),
  district: z.string().trim().min(1).max(64).optional(),
  chiefdom: z.string().trim().min(1).max(64).optional(),
  value_chain: z.string().trim().min(1).max(64).optional(),
  sex: z.enum(["male", "female", "other", "unknown"]).optional(),
  age_group: z.string().trim().min(1).max(32).optional(),
});

export type DashboardFilters = z.infer<typeof dashboardFilterSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(50),
});

export function parseFilters(url: URL) {
  return dashboardFilterSchema.safeParse(Object.fromEntries(url.searchParams));
}

export function parsePagination(url: URL) {
  return paginationSchema.parse({
    page: url.searchParams.get("page") ?? undefined,
    page_size: url.searchParams.get("page_size") ?? undefined,
  });
}

export function filtersToEnvelope(filters: DashboardFilters): Record<string, string | null> {
  return {
    reporting_period: filters.reporting_period ?? null,
    district: filters.district ?? null,
    chiefdom: filters.chiefdom ?? null,
    value_chain: filters.value_chain ?? null,
    sex: filters.sex ?? null,
    age_group: filters.age_group ?? null,
  };
}
