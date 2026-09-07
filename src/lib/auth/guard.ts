import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthenticatedUser } from "./session";
import type { Permission } from "./permissions";

/**
 * Page-level authorisation for the Data Manager.
 *
 * The layout only proves a visitor is signed in. Individual screens carry
 * different sensitivity — beneficiary identity and validation findings can
 * both contain personal data — so each page states the permission it needs and
 * renders nothing without it.
 */
export async function requirePermission(permission: Permission): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.includes(permission)) redirect("/data-manager/denied");
  return user;
}

/** For pages that need a session but no particular capability. */
export async function requireSession(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: AuthenticatedUser | null, permission: Permission): boolean {
  return !!user && user.permissions.includes(permission);
}
