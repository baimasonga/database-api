import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { parseTable } from "@/modules/ingestion/parse";
import { extensionOf } from "@/modules/ingestion/storage";
import type { Connector, ConnectorContext, ConnectorResult } from "../registry";

/**
 * Scheduled file import.
 *
 * Collects the newest CSV/XLSX file from a watched directory. No external API
 * specification is needed, so this connector is fully implemented.
 */

export const fileConnectorConfig = z.object({
  /** Directory to watch. Must sit inside the configured root. */
  directory: z.string().min(1),
  /** Only files matching this extension list are considered. */
  extensions: z.array(z.enum(["csv", "xlsx", "xls"])).default(["csv", "xlsx"]),
  /** Optional filename prefix, so one directory can serve several datasets. */
  filePrefix: z.string().max(120).optional(),
});

export type FileConnectorConfig = z.infer<typeof fileConnectorConfig>;

async function resolveDirectory(raw: unknown): Promise<{ dir: string; config: FileConnectorConfig }> {
  const config = fileConnectorConfig.parse(raw);
  const dir = path.resolve(config.directory);
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Watched directory not found: ${config.directory}`);
  return { dir, config };
}

async function newestFile(dir: string, config: FileConnectorConfig) {
  const entries = await readdir(dir, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((e) => e.isFile())
      .filter((e) => config.extensions.includes(extensionOf(e.name) as "csv" | "xlsx" | "xls"))
      .filter((e) => !config.filePrefix || e.name.startsWith(config.filePrefix))
      .map(async (e) => {
        const full = path.join(dir, e.name);
        return { name: e.name, path: full, mtime: (await stat(full)).mtimeMs };
      }),
  );
  return candidates.sort((a, b) => b.mtime - a.mtime)[0] ?? null;
}

export const FileConnector: Connector = {
  type: "scheduled_file",

  async testConnection(context: ConnectorContext) {
    try {
      const { dir, config } = await resolveDirectory(context.config);
      const file = await newestFile(dir, config);
      return file
        ? { ok: true, message: `Directory reachable. Newest matching file: ${file.name}.` }
        : { ok: false, message: "Directory reachable, but it holds no matching files." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Directory could not be read." };
    }
  },

  async fetch(context: ConnectorContext): Promise<ConnectorResult> {
    const { dir, config } = await resolveDirectory(context.config);
    const file = await newestFile(dir, config);
    if (!file) throw new Error("No matching file found in the watched directory.");

    const buffer = await readFile(file.path);
    const table = await parseTable(buffer, extensionOf(file.name));
    return {
      table,
      recordsReceived: table.rows.length,
      notes: `Collected ${file.name} (${table.rows.length} rows).`,
      sourceFileName: file.name,
      sourceBuffer: buffer,
    };
  },
};
