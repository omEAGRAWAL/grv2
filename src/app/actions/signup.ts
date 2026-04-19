"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/session-config";
import { checkSignupRateLimit, recordSignupAttempt } from "@/lib/rate-limit";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/assets";

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

const SignupSchema = z
  .object({
    companyName: z.string().min(2, "Company name must be at least 2 characters"),
    ownerName: z.string().min(2, "Name must be at least 2 characters"),
    mobile: z
      .string()
      .regex(INDIAN_MOBILE_RE, "Enter a valid 10-digit Indian mobile number"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30)
      .regex(/^[a-z0-9_]+$/, "Username may only contain lowercase letters, numbers, and underscores"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    tos: z.literal("on", { errorMap: () => ({ message: "You must accept the Terms of Service" }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupState = { error: string; field?: string } | null;

export async function signupCompany(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  // IP-based rate limit
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  if (checkSignupRateLimit(ip)) {
    return { error: "Too many signups from your IP address. Try again in an hour." };
  }

  const raw = {
    companyName: formData.get("companyName"),
    ownerName: formData.get("ownerName"),
    mobile: formData.get("mobile"),
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    tos: formData.get("tos"),
  };

  const result = SignupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { error: issue.message, field: issue.path[0] as string };
  }

  const { companyName, ownerName, mobile, username, password } = result.data;

  // Check mobile uniqueness
  const mobileExists = await db.company.findUnique({ where: { ownerMobile: mobile } });
  if (mobileExists) {
    return { error: "This mobile number is already registered", field: "mobile" };
  }

  // Check company name uniqueness
  const nameExists = await db.company.findFirst({ where: { name: companyName } });
  if (nameExists) {
    return { error: "A company with this name already exists", field: "companyName" };
  }

  const passwordHash = await hashPassword(password);
  recordSignupAttempt(ip);

  const company = await db.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: { name: companyName, ownerMobile: mobile, status: "ACTIVE" },
    });
    await tx.user.create({
      data: {
        companyId: newCompany.id,
        username: username.toLowerCase(),
        passwordHash,
        name: ownerName,
        role: "OWNER",
        mobileNumber: mobile,
        mobileVerified: false,
        isActive: true,
      },
    });
    // Seed default asset categories for this company
    await tx.assetCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((name) => ({
        companyId: newCompany.id,
        name,
        isDefault: true,
      })),
    });
    return newCompany;
  });

  // Auto-login
  const newUser = await db.user.findFirst({
    where: { companyId: company.id, role: "OWNER" },
  });
  if (newUser) {
    const session = await getSession();
    session.userId = newUser.id;
    session.role = "OWNER" as SessionData["role"];
    session.companyId = company.id;
    await session.save();
  }

  redirect("/dashboard");
}
