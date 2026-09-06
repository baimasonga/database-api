import type { ParsedTable } from "@/modules/ingestion/types";

/**
 * Connector adapter contract (Phase 16). Every connector produces the same
 * tabular payload, which then enters the standard pipeline:
 *   Connector → Raw Import → Mapping → Validation → Approval → Publication.
 * No connector may write to the core layer directly.
 */
export interface ConnectorContext {
  /** Non-secret settings from Integration.config. */
  config: Record<string, unknown>;
  /** Decrypted secret, supplied only for the duration of a run. */
  secret?: Record<string, unknown>;
  reportingPeriodCode: string;
}

export interface ConnectorResult {
  table: ParsedTable;
  recordsReceived: number;
  notes?: string;
}

export interface Connector {
  readonly type: ConnectorType;
  testConnection(context: ConnectorContext): Promise<{ ok: boolean; message: string }>;
  fetch(context: ConnectorContext): Promise<ConnectorResult>;
}

export type ConnectorType = "rest_api" | "database" | "odk" | "webhook" | "scheduled_file";

export interface ConnectorDescriptor {
  type: ConnectorType;
  label: string;
  description: string;
  /** False until a concrete adapter is registered for this connector type. */
  implemented: boolean;
}

export const CONNECTORS: ConnectorDescriptor[] = [
  {
    type: "rest_api",
    label: "REST API",
    description: "Pulls tabular JSON from an authenticated HTTP endpoint on a schedule.",
    implemented: false,
  },
  {
    type: "database",
    label: "Database",
    description: "Reads a whitelisted query or view from an external operational database.",
    implemented: false,
  },
  {
    type: "odk",
    label: "ODK / Kobo",
    description: "Retrieves submissions from an ODK-compatible form server.",
    implemented: false,
  },
  {
    type: "webhook",
    label: "Webhook",
    description: "Accepts pushed payloads from a source system into the raw layer.",
    implemented: false,
  },
  {
    type: "scheduled_file",
    label: "Scheduled file import",
    description: "Collects CSV/XLSX files from a watched location on a schedule.",
    implemented: false,
  },
];

const registry = new Map<ConnectorType, Connector>();

export function registerConnector(connector: Connector): void {
  registry.set(connector.type, connector);
}

export function getConnector(type: ConnectorType): Connector | undefined {
  return registry.get(type);
}
