"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email address and password." };

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown user and wrong password — no account enumeration.
  const invalid = { error: "Email address or password is incorrect." };
  if (!user || user.status !== "active") return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

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
