"use server";

import Decimal from "decimal.js";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { getAvailableMaterial, calcCostMoved, type AvailableItem } from "@/lib/material";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

type ActionResult = { success: false; error: string };

const MaterialTransferSchema = z.object({
  // "CENTRAL_STORE" → null in DB
  fromSourceId: z.string().min(1, "From location is required"),
  toSiteId: z.string().min(1, "To site is required"),
  itemName: z.string().min(1, "Item is required"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    }, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  transferDate: z.string().min(1, "Transfer date is required"),
  note: z.string().max(500).optional(),
});

export async function createMaterialTransfer(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult | never> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can transfer material" };
  }

  const raw = {
    fromSourceId: (formData.get("fromSourceId") as string) ?? "",
    toSiteId: (formData.get("toSiteId") as string) ?? "",
    itemName: (formData.get("itemName") as string) ?? "",
    quantity: (formData.get("quantity") as string) ?? "",
    unit: (formData.get("unit") as string) ?? "",
    transferDate: (formData.get("transferDate") as string) ?? "",
    note: (formData.get("note") as string) || undefined,
  };

  const parsed = MaterialTransferSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Resolve sentinel value for "Central Store"
  const fromSiteId =
    parsed.data.fromSourceId === "CENTRAL_STORE"
      ? null
      : parsed.data.fromSourceId;

  // Cannot transfer to and from the same location
  if (fromSiteId === parsed.data.toSiteId) {
    return {
      success: false,
      error: "From and To locations must be different",
    };
  }

  // Get available material at source to validate qty and compute cost
  const available = await getAvailableMaterial(fromSiteId);
  const sourceItem = available.find(
    (item) =>
      item.itemName === parsed.data.itemName &&
      item.unit === parsed.data.unit
  );

  if (!sourceItem) {
    return {
      success: false,
      error: `${parsed.data.itemName} is not available at the selected source`,
    };
  }

  const requestedQty = new Decimal(parsed.data.quantity);
  const availableQty = new Decimal(sourceItem.availableQty);

  if (requestedQty.gt(availableQty)) {
    return {
      success: false,
      error: `Cannot transfer ${requestedQty.toString()} ${parsed.data.unit} — only ${availableQty.toFixed(4)} available`,
    };
  }

  // Proportional cost: costMoved = totalCost × (qtyToMove / availableQty)
  const costMovedPaise = calcCostMoved(
    sourceItem.totalCostPaise,
    sourceItem.availableQty,
    parsed.data.quantity
  );

  await db.$transaction(async (tx) => {
    await tx.materialTransfer.create({
      data: {
        companyId: currentUser.effectiveCompanyId!,
        fromSiteId,
        toSiteId: parsed.data.toSiteId,
        itemName: parsed.data.itemName,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        costMovedPaise,
        transferDate: new Date(parsed.data.transferDate),
        note: parsed.data.note ?? null,
        loggedById: currentUser.id,
      },
    });
  });

  revalidatePath("/material-transfers/new");
  if (fromSiteId) revalidatePath(`/sites/${fromSiteId}`);
  revalidatePath(`/sites/${parsed.data.toSiteId}`);

  redirect(`/sites/${parsed.data.toSiteId}`);
}

/**
 * Server action to get available material at a source.
 * Called from the material transfer form when source changes.
 * Returns JSON-serializable data (no BigInt).
 */
export async function getAvailableMaterialAction(
  sourceId: string | null
): Promise<AvailableItem[]> {
  try {
    await requireOwner();
  } catch {
    return [];
  }
  return getAvailableMaterial(sourceId);
}

/**
 * Void a material transfer (owner-only). No wallet impact — just marks voided.
 */
export async function voidMaterialTransfer(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can void transfers" };
  }

  const transfer = await db.materialTransfer.findUnique({
    where: { id },
    select: {
      id: true,
      fromSiteId: true,
      toSiteId: true,
      voidedAt: true,
    },
  });

  if (!transfer) return { success: false, error: "Transfer not found" };
  if (transfer.voidedAt) return { success: false, error: "Transfer already voided" };

  await db.$transaction(async (tx) => {
    await tx.materialTransfer.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });
  });

  if (transfer.fromSiteId) revalidatePath(`/sites/${transfer.fromSiteId}`);
  revalidatePath(`/sites/${transfer.toSiteId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
