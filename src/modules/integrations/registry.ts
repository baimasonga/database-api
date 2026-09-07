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
  /** Original file name, when the connector collected a real file. */
  sourceFileName?: string;
  /** Original bytes, retained verbatim so lineage survives the connector. */
  sourceBuffer?: Buffer;
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
    description:
      "Pulls an array of records from a configured JSON endpoint. System-agnostic: it needs a URL and a records path, not a particular system's API specification.",
    implemented: true,
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
    description: "Collects the newest matching CSV/XLSX file from a watched directory.",
    implemented: true,
  },
];

const registry = new Map<ConnectorType, Connector>();

export function registerConnector(connector: Connector): void {
  registry.set(connector.type, connector);
}

export function getConnector(type: ConnectorType): Connector | undefined {
  return registry.get(type);
}

export function isImplemented(type: ConnectorType): boolean {
  return CONNECTORS.find((c) => c.type === type)?.implemented ?? false;
}
