import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/** Extensions that must never be accepted, whatever the configuration says. */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "so", "bat", "cmd", "com", "sh", "bash", "ps1", "msi", "app",
  "jar", "js", "mjs", "cjs", "py", "rb", "php", "pl", "vbs", "scr", "html", "htm", "svg",
]);

const ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

export class UploadRejected extends Error {
  constructor(
    message: string,
    readonly code: "extension" | "mime" | "size" | "empty" | "name",
  ) {
    super(message);
    this.name = "UploadRejected";
  }
}

export function sanitiseFileName(name: string): string {
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!base || base.startsWith(".")) throw new UploadRejected("Invalid file name.", "name");
  return base.slice(0, 180);
}

export function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace(/^\./, "");
}

export function assertUploadAllowed(fileName: string, mimeType: string, sizeBytes: number): void {
  const safeName = sanitiseFileName(fileName);
  const ext = extensionOf(safeName);
  if (!ext) throw new UploadRejected("File has no extension.", "extension");
  if (BLOCKED_EXTENSIONS.has(ext)) throw new UploadRejected(`Executable files are not accepted (.${ext}).`, "extension");
  if (!env.uploadAllowedExtensions().includes(ext)) {
    throw new UploadRejected(
      `Unsupported file type .${ext}. Allowed: ${env.uploadAllowedExtensions().join(", ")}.`,
      "extension",
    );
  }
  if (mimeType && !ALLOWED_MIME.has(mimeType)) throw new UploadRejected(`Unsupported content type ${mimeType}.`, "mime");
  if (sizeBytes <= 0) throw new UploadRejected("File is empty.", "empty");
  if (sizeBytes > env.uploadMaxBytes()) {
    throw new UploadRejected(
      `File exceeds the ${Math.floor(env.uploadMaxBytes() / (1024 * 1024))} MB limit.`,
      "size",
    );
  }
}

export function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface StoredFile {
  storagePath: string;
  checksum: string;
  sizeBytes: number;
  extension: string;
  fileName: string;
}

/**
 * Persists an uploaded file outside the public web root. Files are addressed by
 * an opaque generated path and are only ever served through an authenticated
 * route handler.
 */
export async function storeUpload(
  originalName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<StoredFile> {
  const fileName = sanitiseFileName(originalName);
  assertUploadAllowed(fileName, mimeType, buffer.byteLength);
  const digest = checksum(buffer);
  const dir = path.resolve(env.uploadDir(), digest.slice(0, 2), digest.slice(2, 4));
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${digest}.${extensionOf(fileName)}`);
  await writeFile(storagePath, buffer, { flag: "w" });
  return {
    storagePath,
    checksum: digest,
    sizeBytes: buffer.byteLength,
    extension: extensionOf(fileName),
    fileName,
  };
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  const root = path.resolve(env.uploadDir());
  const resolved = path.resolve(storagePath);
  // Defence in depth: never read outside the configured upload root.
  if (!resolved.startsWith(root + path.sep)) throw new Error("Refusing to read outside the upload directory.");
  return readFile(resolved);
}
