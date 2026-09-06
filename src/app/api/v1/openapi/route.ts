import { NextResponse } from "next/server";

const FILTER_PARAMS = ["reporting_period", "district", "chiefdom", "value_chain", "sex", "age_group"].map((name) => ({
  name,
  in: "query",
  required: false,
  schema: { type: "string" },
}));

const envelope = (dataSchema: object) => ({
  type: "object",
  properties: {
    data: dataSchema,
    metadata: {
      type: "object",
      properties: {
        generated_at: { type: "string", format: "date-time" },
        source: { type: "string", enum: ["analytics"] },
        last_updated: { type: "string", format: "date-time", nullable: true },
        reporting_period: { type: "string", nullable: true },
        pagination: {
          type: "object",
          nullable: true,
          properties: {
            page: { type: "integer" },
            page_size: { type: "integer" },
            total: { type: "integer" },
            total_pages: { type: "integer" },
          },
        },
      },
    },
    filters: { type: "object", additionalProperties: true },
  },
});

const path = (summary: string, dataSchema: object, extraParams: object[] = []) => ({
  get: {
    summary,
    parameters: [...FILTER_PARAMS, ...extraParams],
    responses: {
      "200": { description: "Success", content: { "application/json": { schema: envelope(dataSchema) } } },
      "400": { description: "Invalid query parameters" },
      "429": { description: "Rate limit exceeded" },
    },
  },
});

const OBJECT = { type: "object", additionalProperties: true };
const ARRAY = { type: "array", items: OBJECT };
const PAGE_PARAMS = [
  { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1 } },
  { name: "page_size", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 200 } },
];

/** OpenAPI description of the read-only AVDP Dashboard API. */
export function GET() {
  return NextResponse.json({
    openapi: "3.0.3",
    info: {
      title: "AVDP Dashboard API",
      version: "1.0.0",
      description:
        "Read-only analytics API serving the AVDP dashboard. All responses derive exclusively from validated, approved and published AVDP datasets.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/dashboard/summary": path("Headline dashboard summary", OBJECT),
      "/indicators": path("Indicator registry with performance", ARRAY, PAGE_PARAMS),
      "/indicators/{code}": {
        ...path("Indicator detail", OBJECT),
        get: {
          ...path("Indicator detail", OBJECT).get,
          parameters: [
            { name: "code", in: "path", required: true, schema: { type: "string" } },
            ...FILTER_PARAMS,
          ],
        },
      },
      "/indicators/{code}/lineage": {
        get: {
          summary: "Indicator data lineage",
          parameters: [
            { name: "code", in: "path", required: true, schema: { type: "string" } },
            ...FILTER_PARAMS,
          ],
          responses: { "200": { description: "Success" }, "404": { description: "Indicator not registered" } },
        },
      },
      "/geography/districts": path("District summaries", ARRAY, PAGE_PARAMS),
      "/geography/districts/{id}/summary": {
        get: {
          summary: "Single district summary",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, ...FILTER_PARAMS],
          responses: { "200": { description: "Success" }, "404": { description: "District not found" } },
        },
      },
      "/value-chains": path("Value chain summaries", ARRAY, PAGE_PARAMS),
      "/value-chains/{id}/summary": {
        get: {
          summary: "Single value chain summary",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, ...FILTER_PARAMS],
          responses: { "200": { description: "Success" }, "404": { description: "Value chain not found" } },
        },
      },
      "/beneficiaries/summary": path("Beneficiary summary", OBJECT),
      "/production/summary": path("Production summary", OBJECT),
      "/training/summary": path("Training summary", OBJECT),
      "/infrastructure/summary": path("Infrastructure summary", OBJECT),
    },
  });
}
