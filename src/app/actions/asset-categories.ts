"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type CategoryActionResult =
  | { success: true }
  | { success: false; error: string };

const NameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(50, "Name must be at most 50 characters");

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCategory(
  _prev: CategoryActionResult | null,
  formData: FormData
): Promise<CategoryActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) return { success: false, error: name.error.issues[0].message };

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company context" };

  const existing = await db.assetCategory.findUnique({
    where: { companyId_name: { companyId, name: name.data } },
  });
  if (existing) return { success: false, error: "A category with this name already exists" };

  await db.assetCategory.create({ data: { companyId, name: name.data } });
  revalidatePath("/assets/categories");
  return { success: true };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateCategory(
  _prev: CategoryActionResult | null,
  formData: FormData
): Promise<CategoryActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const id = formData.get("id") as string;
  const name = NameSchema.safeParse(formData.get("name"));
  if (!name.success) return { success: false, error: name.error.issues[0].message };

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  const category = await db.assetCategory.findUnique({ where: { id } });
  if (!category || category.companyId !== companyId) {
    return { success: false, error: "Category not found" };
  }
  if (category.isDefault) return { success: false, error: "Default categories cannot be renamed" };

  const conflict = await db.assetCategory.findFirst({
    where: { companyId: companyId!, name: name.data, id: { not: id } },
  });
  if (conflict) return { success: false, error: "A category with this name already exists" };

  await db.assetCategory.update({ where: { id }, data: { name: name.data } });
  revalidatePath("/assets/categories");
  return { success: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCategory(
  id: string
): Promise<CategoryActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  const category = await db.assetCategory.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });
  if (!category || category.companyId !== companyId) {
    return { success: false, error: "Category not found" };
  }
  if (category.isDefault) {
    return { success: false, error: "Default categories cannot be deleted" };
  }
  if (category._count.assets > 0) {
    return {
      success: false,
      error: `Category is in use by ${category._count.assets} asset${category._count.assets !== 1 ? "s" : ""}. Reassign them first.`,
    };
  }

  await db.assetCategory.delete({ where: { id } });
  revalidatePath("/assets/categories");
  return { success: true };
}
