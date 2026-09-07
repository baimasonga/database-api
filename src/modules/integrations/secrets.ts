import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Encryption for connector credentials (Phase 16).
 *
 * Secrets are encrypted at rest with AES-256-GCM and are never returned by any
 * API response. The authentication tag makes tampering detectable, and the key
 * lives only in the environment — never in the database beside the ciphertext.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const VERSION = "v1";

export class SecretKeyMissing extends Error {
  constructor() {
    super(
      "INTEGRATION_SECRET_KEY is not configured. Generate one with `openssl rand -base64 32` " +
        "before storing connector credentials.",
    );
    this.name = "SecretKeyMissing";
  }
}

export class SecretDecryptionFailed extends Error {
  constructor(message: string) {
    super(`Connector secret could not be decrypted: ${message}`);
    this.name = "SecretDecryptionFailed";
  }
}

function key(): Buffer {
  const raw = env.integrationSecretKey();
  if (!raw) throw new SecretKeyMissing();
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length !== 32) {
    throw new SecretKeyMissing();
  }
  return buffer;
}

export function secretsConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a secret object. The result is self-describing —
 * `v1.<iv>.<tag>.<ciphertext>`, all base64url — so the format can be rotated
 * later without guessing how existing rows were written.
 */
export function encryptSecret(secret: Record<string, unknown>): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const plaintext = Buffer.from(JSON.stringify(secret), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): Record<string, unknown> {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new SecretDecryptionFailed("malformed payload");
  const [version, ivPart, tagPart, dataPart] = parts;
  if (version !== VERSION) throw new SecretDecryptionFailed(`unsupported format "${version}"`);

  try {
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    // A wrong key and a tampered payload both land here, deliberately
    // indistinguishable to the caller.
    throw new SecretDecryptionFailed(error instanceof Error ? error.message : "unknown error");
  }
}

/** Constant-time comparison, for verifying inbound webhook tokens. */
export function secretsMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Strips every secret-bearing field from an integration before it is sent to a
 * client. Callers pass whole rows, so this is the single point where a
 * credential could otherwise escape.
 */
export function redactIntegration<T extends Record<string, unknown>>(
  integration: T,
): Omit<T, "secretCiphertext"> & { hasSecret: boolean } {
  const { secretCiphertext, ...rest } = integration as T & { secretCiphertext?: string | null };
  return { ...(rest as Omit<T, "secretCiphertext">), hasSecret: !!secretCiphertext };
}
