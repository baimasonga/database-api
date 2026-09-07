import "server-only";
import { z } from "zod";
import type { ParsedTable } from "@/modules/ingestion/types";
import type { Connector, ConnectorContext, ConnectorResult } from "../registry";

/**
 * Generic REST API connector.
 *
 * Deliberately system-agnostic: it fetches JSON from a configured URL and
 * reads an array of flat records from a configured path. It carries no
 * knowledge of any particular AVDP source system, so it needs no external API
 * specification — a system-specific connector is still a separate adapter.
 */

export const restConnectorConfig = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST"]).default("GET"),
  /** Dot path to the array of records, e.g. "data.results". Empty = the root. */
  recordsPath: z.string().default(""),
  authType: z.enum(["none", "bearer", "api_key", "basic"]).default("none"),
  /** Header name used when authType is api_key. */
  apiKeyHeader: z.string().default("x-api-key"),
  headers: z.record(z.string(), z.string()).default({}),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
  maxRecords: z.number().int().min(1).max(100_000).default(50_000),
});

export type RestConnectorConfig = z.infer<typeof restConnectorConfig>;

/** Credentials live in the encrypted secret, never in the config. */
const restSecret = z.object({
  token: z.string().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

function authHeaders(
  config: RestConnectorConfig,
  secret: Record<string, unknown> | undefined,
): Record<string, string> {
  const parsed = restSecret.safeParse(secret ?? {});
  const creds = parsed.success ? parsed.data : {};
  switch (config.authType) {
    case "bearer":
      return creds.token ? { authorization: `Bearer ${creds.token}` } : {};
    case "api_key":
      return creds.apiKey ? { [config.apiKeyHeader]: creds.apiKey } : {};
    case "basic":
      return creds.username
        ? {
            authorization: `Basic ${Buffer.from(`${creds.username}:${creds.password ?? ""}`).toString("base64")}`,
          }
        : {};
    default:
      return {};
  }
}

function valueAtPath(payload: unknown, dotPath: string): unknown {
  if (!dotPath) return payload;
  return dotPath.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, payload);
}

/**
 * Flattens records to a table. Nested objects and arrays are serialised rather
 * than dropped, so no inbound field is silently lost before profiling.
 */
export function recordsToTable(records: Array<Record<string, unknown>>): ParsedTable {
  const columns: string[] = [];
  for (const record of records) {
    for (const key of Object.keys(record)) if (!columns.includes(key)) columns.push(key);
  }
  const rows = records.map((record) => {
    const row: Record<string, string | null> = {};
    for (const column of columns) {
      const value = record[column];
      if (value === null || value === undefined) row[column] = null;
      else if (typeof value === "object") row[column] = JSON.stringify(value);
      else row[column] = String(value);
    }
    return row;
  });
  return { columns, rows };
}

async function request(context: ConnectorContext): Promise<unknown> {
  const config = restConnectorConfig.parse(context.config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: { accept: "application/json", ...config.headers, ...authHeaders(config, context.secret) },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Endpoint returned ${response.status} ${response.statusText}.`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export const RestApiConnector: Connector = {
  type: "rest_api",

  async testConnection(context: ConnectorContext) {
    try {
      const config = restConnectorConfig.parse(context.config);
      const payload = await request(context);
      const records = valueAtPath(payload, config.recordsPath);
      if (!Array.isArray(records)) {
        return {
          ok: false,
          message: `Endpoint reachable, but no array was found at "${config.recordsPath || "(root)"}".`,
        };
      }
      return { ok: true, message: `Endpoint reachable. ${records.length} record(s) available.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Endpoint could not be reached." };
    }
  },

  async fetch(context: ConnectorContext): Promise<ConnectorResult> {
    const config = restConnectorConfig.parse(context.config);
    const payload = await request(context);
    const records = valueAtPath(payload, config.recordsPath);
    if (!Array.isArray(records)) {
      throw new Error(`No array of records found at "${config.recordsPath || "(root)"}".`);
    }
    if (records.length > config.maxRecords) {
      throw new Error(`Endpoint returned ${records.length} records, above the configured maximum of ${config.maxRecords}.`);
    }
    const table = recordsToTable(records as Array<Record<string, unknown>>);
    return {
      table,
      recordsReceived: records.length,
      notes: `Fetched ${records.length} record(s) from ${config.url}.`,
    };
  },
};
