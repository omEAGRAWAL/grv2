"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { getUnscopedDb } from "@/lib/db";
import { verifyPassword, getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/session-config";
import {
  checkRateLimit,
  recordFailure,
  resetFailures,
} from "@/lib/rate-limit";

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const raw = {
    username: formData.get("username"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { error: "Invalid username or password" };
  }

  const { username, password, next } = result.data;
  const normalizedUsername = username.toLowerCase().trim();

  // Check rate limit first (fail fast before hitting DB)
  if (checkRateLimit(normalizedUsername)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const GENERIC_ERROR = "Invalid username or password";

  // Find user by username globally. With multi-tenancy, same username may exist
  // across companies — a future login screen should add a company-code field
  // for disambiguation. For now, we use findFirst (SUPERADMIN has null companyId).
  // SUPERADMIN: cross-tenant query intended — login lookup must find any user by username
  const db = getUnscopedDb();
  const user = await db.user.findFirst({
    where: { username: normalizedUsername },
  });

  if (!user) {
    recordFailure(normalizedUsername);
    return { error: GENERIC_ERROR };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    recordFailure(normalizedUsername);
    return { error: GENERIC_ERROR };
  }

  if (!user.isActive) {
    return { error: "Your account has been deactivated. Contact your manager." };
  }

  // Reject login if company is suspended
  if (user.companyId) {
    const company = await db.company.findUnique({
      where: { id: user.companyId },
      select: { status: true },
    });
    if (company?.status === "SUSPENDED") {
      return { error: "This account has been suspended. Contact support." };
    }
  }

  // Success
  resetFailures(normalizedUsername);

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as SessionData["role"];
  session.companyId = user.companyId ?? undefined;
  await session.save();

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Honour ?next= param; guard against open-redirect by requiring relative paths
  const destination =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await session.destroy();
  redirect("/login");
}
