import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Permission } from "./permissions";

export const SESSION_COOKIE = "avdp_session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  unit: string | null;
  roles: string[];
  permissions: Permission[];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.sessionTtlHours() * 3600 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

/** Resolves the current user, or null when unauthenticated. Never throws. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveUserFromToken(token);
}

export async function resolveUserFromToken(token: string): Promise<AuthenticatedUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.status !== "active") return null;

  const permissions = new Set<string>();
  for (const ur of session.user.roles) {
    for (const rp of ur.role.permissions) permissions.add(rp.permission.code);
  }
  return {
    id: session.user.id,
    email: session.user.email,
    fullName: session.user.fullName,
    unit: session.user.unit,
    roles: session.user.roles.map((r) => r.role.code),
    permissions: [...permissions] as Permission[],
  };
}

export function hasPermission(user: AuthenticatedUser | null, permission: Permission): boolean {
  return !!user && user.permissions.includes(permission);
}
