"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createAllocation } from "@/lib/assets";
import { deleteAsset as deleteCloudinaryAsset } from "@/lib/cloudinary";

export type AssetActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const AssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  categoryId: z.string().min(1, "Category is required"),
  ownershipType: z.enum(["OWNED", "RENTED"]),
  defaultDailyCostPaise: z.coerce.bigint().positive().optional().nullable(),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "DECOMMISSIONED"]).default("AVAILABLE"),
  notes: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  photoPublicId: z.string().optional().nullable(),
});

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAsset(
  _prev: AssetActionResult | null,
  formData: FormData
): Promise<AssetActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company context" };

  const rawCost = formData.get("defaultDailyCostPaise");
  const parsed = AssetSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    ownershipType: formData.get("ownershipType"),
    defaultDailyCostPaise: rawCost && rawCost !== "" ? rawCost : null,
    status: formData.get("status") ?? "AVAILABLE",
    notes: formData.get("notes") || null,
    photoUrl: formData.get("photoUrl") || null,
    photoPublicId: formData.get("photoPublicId") || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  // Verify category belongs to this company
  const category = await db.assetCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || category.companyId !== companyId) {
    return { success: false, error: "Invalid category" };
  }

  const existing = await db.asset.findUnique({
    where: { companyId_name: { companyId, name: parsed.data.name } },
  });
  if (existing) return { success: false, error: "An asset with this name already exists" };

  const asset = await db.asset.create({
    data: {
      companyId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      ownershipType: parsed.data.ownershipType,
      defaultDailyCostPaise: parsed.data.defaultDailyCostPaise ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      photoUrl: parsed.data.photoUrl ?? null,
      photoPublicId: parsed.data.photoPublicId ?? null,
    },
  });

  revalidatePath("/assets");
  return { success: true, id: asset.id };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateAsset(
  _prev: AssetActionResult | null,
  formData: FormData
): Promise<AssetActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const id = formData.get("id") as string;
  const companyId = caller.effectiveCompanyId ?? caller.companyId;

  const existing = await db.asset.findUnique({ where: { id } });
  if (!existing || existing.companyId !== companyId) {
    return { success: false, error: "Asset not found" };
  }

  const rawCost = formData.get("defaultDailyCostPaise");
  const parsed = AssetSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    ownershipType: formData.get("ownershipType"),
    defaultDailyCostPaise: rawCost && rawCost !== "" ? rawCost : null,
    status: formData.get("status") ?? existing.status,
    notes: formData.get("notes") || null,
    photoUrl: formData.get("photoUrl") || null,
    photoPublicId: formData.get("photoPublicId") || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const nameConflict = await db.asset.findFirst({
    where: { companyId: companyId!, name: parsed.data.name, id: { not: id } },
  });
  if (nameConflict) return { success: false, error: "An asset with this name already exists" };

  await db.asset.update({
    where: { id },
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      ownershipType: parsed.data.ownershipType,
      defaultDailyCostPaise: parsed.data.defaultDailyCostPaise ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
      photoUrl: parsed.data.photoUrl ?? null,
      photoPublicId: parsed.data.photoPublicId ?? null,
    },
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return { success: true };
}

// ─── Change Status ────────────────────────────────────────────────────────────

export async function changeAssetStatus(
  assetId: string,
  status: "AVAILABLE" | "MAINTENANCE" | "DECOMMISSIONED"
): Promise<AssetActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.companyId !== companyId) {
    return { success: false, error: "Asset not found" };
  }

  await db.asset.update({ where: { id: assetId }, data: { status } });
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/assets");
  return { success: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteAsset(assetId: string): Promise<AssetActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: { _count: { select: { allocations: true } } },
  });
  if (!asset || asset.companyId !== companyId) {
    return { success: false, error: "Asset not found" };
  }
  if (asset._count.allocations > 0) {
    return {
      success: false,
      error: "Cannot delete — this asset has allocation history. Decommission it instead.",
    };
  }

  if (asset.photoPublicId) {
    await deleteCloudinaryAsset(asset.photoPublicId).catch(() => null);
  }

  await db.asset.delete({ where: { id: assetId } });
  revalidatePath("/assets");
  return { success: true };
}

// ─── Allocation actions ───────────────────────────────────────────────────────

export type AllocationActionResult =
  | { success: true }
  | { success: false; error: string };

const AllocationSchema = z.object({
  assetId: z.string().min(1),
  siteId: z.string().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyCostPaise: z.coerce.bigint().positive().optional().nullable(),
  includeInSiteCost: z.enum(["true", "false"]).transform((v) => v === "true").default("true"),
  notes: z.string().max(500).optional().nullable(),
});

export async function createAssetAllocation(
  _prev: AllocationActionResult | null,
  formData: FormData
): Promise<AllocationActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company context" };

  const rawCost = formData.get("dailyCostPaise");
  const rawSiteId = formData.get("siteId") as string | null;
  const parsed = AllocationSchema.safeParse({
    assetId: formData.get("assetId"),
    siteId: rawSiteId || null,
    startDate: formData.get("startDate"),
    dailyCostPaise: rawCost && rawCost !== "" ? rawCost : null,
    includeInSiteCost: formData.get("includeInSiteCost") ?? "true",
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  // SUPERVISOR: can only allocate to assigned sites (or "return to yard")
  if (caller.role === "SUPERVISOR" && parsed.data.siteId) {
    const assignment = await db.siteAssignment.findFirst({
      where: { userId: caller.id, siteId: parsed.data.siteId, companyId },
    });
    if (!assignment) {
      return { success: false, error: "You are not assigned to that site" };
    }
  }

  const startDate = new Date(parsed.data.startDate);
  // Validate backdating limit (90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  if (startDate < cutoff) {
    return { success: false, error: "Cannot backdate more than 90 days" };
  }

  try {
    await createAllocation({
      assetId: parsed.data.assetId,
      siteId: parsed.data.siteId ?? null,
      startDate,
      dailyCostPaise: parsed.data.dailyCostPaise ?? null,
      includeInSiteCost: parsed.data.includeInSiteCost,
      notes: parsed.data.notes ?? null,
      loggedById: caller.id,
      companyId,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create allocation" };
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${parsed.data.assetId}`);
  if (parsed.data.siteId) revalidatePath(`/sites/${parsed.data.siteId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function voidAssetAllocation(
  allocationId: string
): Promise<AllocationActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  const allocation = await db.assetAllocation.findUnique({ where: { id: allocationId } });
  if (!allocation || allocation.companyId !== companyId) {
    return { success: false, error: "Allocation not found" };
  }
  if (allocation.voidedAt) {
    return { success: false, error: "Already voided" };
  }

  await db.assetAllocation.update({
    where: { id: allocationId },
    data: { voidedAt: new Date(), voidedById: caller.id },
  });

  revalidatePath(`/assets/${allocation.assetId}`);
  if (allocation.siteId) revalidatePath(`/sites/${allocation.siteId}`);
  revalidatePath("/assets");
  return { success: true };
}
