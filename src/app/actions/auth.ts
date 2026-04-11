"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword, getSession } from "@/lib/auth";
import {
  checkRateLimit,
  recordFailure,
  resetFailures,
} from "@/lib/rate-limit";

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const raw = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { error: "Invalid username or password" };
  }

  const { username, password } = result.data;
  const normalizedUsername = username.toLowerCase().trim();

  // Check rate limit first (fail fast before hitting DB)
  if (checkRateLimit(normalizedUsername)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const GENERIC_ERROR = "Invalid username or password";

  const user = await db.user.findUnique({
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
    // Don't increment rate limit for inactive users (known state, not brute force)
    return { error: "Your account has been deactivated. Contact your manager." };
  }

  // Success
  resetFailures(normalizedUsername);

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as "OWNER" | "EMPLOYEE";
  await session.save();

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await session.destroy();
  redirect("/login");
}
