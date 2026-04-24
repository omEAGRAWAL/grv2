"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

type ActionResult = { success: false; error: string } | { success: true };

const MaterialSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  unit: z.string().min(1, "Unit is required").max(50),
});

export async function createMaterial(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const companyId = currentUser.effectiveCompanyId!;
  const raw = {
    name: (formData.get("name") as string) ?? "",
    unit: (formData.get("unit") as string) ?? "",
  };

  const parsed = MaterialSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await db.material.findFirst({
    where: { companyId, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (existing) {
    return { success: false, error: "A material with this name already exists" };
  }

  await db.material.create({
    data: {
      companyId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      isDefault: false,
    },
  });

  revalidatePath("/materials");
  return { success: true };
}

export async function updateMaterial(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const companyId = currentUser.effectiveCompanyId!;
  const raw = {
    name: (formData.get("name") as string) ?? "",
    unit: (formData.get("unit") as string) ?? "",
  };

  const parsed = MaterialSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const material = await db.material.findFirst({ where: { id, companyId } });
  if (!material) return { success: false, error: "Material not found" };
  if (material.isDefault) return { success: false, error: "Cannot edit default materials" };

  const conflict = await db.material.findFirst({
    where: {
      companyId,
      name: { equals: parsed.data.name, mode: "insensitive" },
      id: { not: id },
    },
  });
  if (conflict) {
    return { success: false, error: "A material with this name already exists" };
  }

  await db.material.update({
    where: { id },
    data: { name: parsed.data.name, unit: parsed.data.unit },
  });

  revalidatePath("/materials");
  return { success: true };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const companyId = currentUser.effectiveCompanyId!;
  const material = await db.material.findFirst({ where: { id, companyId } });
  if (!material) return { success: false, error: "Material not found" };
  if (material.isDefault) return { success: false, error: "Cannot delete default materials" };

  // Reject if used in any active purchase line or material consumption
  const purchaseUsage = await db.purchase.findFirst({
    where: { companyId, itemName: material.name, voidedAt: null },
    select: { id: true },
  });
  if (purchaseUsage) {
    return {
      success: false,
      error: "Cannot delete: material is used in one or more purchases",
    };
  }

  const consumptionUsage = await db.materialConsumption.findFirst({
    where: { companyId, itemName: material.name, voidedAt: null },
    select: { id: true },
  });
  if (consumptionUsage) {
    return {
      success: false,
      error: "Cannot delete: material is used in one or more consumption records",
    };
  }

  await db.material.delete({ where: { id } });

  revalidatePath("/materials");
  return { success: true };
}
