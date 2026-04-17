"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, requireOwner } from "@/lib/auth";

type ActionResult = { success: true } | { success: false; error: string };

// ─── Create Employee ──────────────────────────────────────────────────────────

const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Username can only contain lowercase letters, numbers, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function createEmployee(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const result = CreateEmployeeSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, username, password } = result.data;
  const normalizedUsername = username.toLowerCase();
  const companyId = owner.effectiveCompanyId;

  // Username must be unique within the same company
  const existing = await db.user.findFirst({
    where: { companyId: companyId ?? null, username: normalizedUsername },
  });
  if (existing) {
    return { success: false, error: "Username already taken" };
  }

  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: {
      companyId: companyId ?? null,
      username: normalizedUsername,
      passwordHash,
      name,
      role: "EMPLOYEE",
      joinedAt: new Date(),
      isActive: true,
    },
  });

  revalidatePath("/employees");
  return { success: true };
}

// ─── Reset Password ───────────────────────────────────────────────────────────

const ResetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPassword(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireOwner();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const result = ResetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
  });
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input" };
  }

  const { userId, newPassword } = result.data;
  const passwordHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  revalidatePath("/employees");
  return { success: true };
}

// ─── Toggle Active ────────────────────────────────────────────────────────────

const ToggleActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.enum(["true", "false"]),
});

export async function toggleEmployeeActive(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner().catch(() => null);
  if (!owner) return { success: false, error: "Unauthorized" };

  const result = ToggleActiveSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
  });
  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  const { userId, active } = result.data;
  const isActive = active === "true";

  if (userId === owner.id) {
    return { success: false, error: "You cannot deactivate your own account" };
  }

  await db.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${userId}`);
  return { success: true };
}
