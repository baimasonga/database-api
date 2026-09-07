"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure } from "@/lib/auth/throttle";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password." };

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const keys = [`email:${email}`, `ip:${ip}`];

  const throttle = checkLoginThrottle(keys);
  if (!throttle.allowed) {
    return {
      error: `Too many failed sign-in attempts. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown user and wrong password — no account enumeration.
  const invalid = { error: "Email address or password is incorrect." };

  if (!user || user.status !== "active" || !(await verifyPassword(password, user.passwordHash))) {
    recordLoginFailure(keys);
    await recordAudit(null, {
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      summary: `Failed sign-in for ${email} from ${ip}`,
    });
    return invalid;
  }

  clearLoginFailures(keys);
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordAudit(
    { id: user.id, email: user.email, fullName: user.fullName, unit: user.unit, roles: [], permissions: [] },
    { action: "auth.login", entityType: "user", entityId: user.id },
  );
  redirect("/data-manager");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
