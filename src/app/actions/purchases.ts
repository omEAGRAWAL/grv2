"use server";

import Decimal from "decimal.js";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { toPaise } from "@/lib/money";
import { calcPurchaseTotalPaise } from "@/lib/purchase-math";

type ActionResult = { success: false; error: string };

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const PurchaseSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  itemName: z.string().min(1, "Item name is required").max(200),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    }, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required").max(50),
  rateRupees: z
    .string()
    .min(1, "Rate is required")
    .refine((v) => {
      try {
        return toPaise(v) > 0n;
      } catch {
        return false;
      }
    }, "Rate must be greater than ₹0"),
  discountPercent: z
    .string()
    .default("0")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 100;
    }, "Discount must be 0–100"),
  gstPercent: z
    .string()
    .default("0")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 0 && n <= 100;
    }, "GST must be 0–100"),
  // "CENTRAL_STORE" sentinel → null in DB
  destinationSiteId: z.string().optional(),
  // "OWNER_DIRECT" sentinel → null in DB (no wallet impact)
  paidByUserId: z.string().optional(),
  purchaseDate: z
    .string()
    .min(1, "Purchase date is required")
    .refine((v) => !isNaN(Date.parse(v)), "Invalid purchase date"),
  billPhotoUrl: z.string().url().optional().or(z.literal("")),
  billPhotoPublicId: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function createPurchase(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult | never> {
  try {
    await requireOwner();
  } catch {
    return { success: false, error: "Only owners can log purchases" };
  }

  const currentUser = await getCurrentUser();

  const raw = {
    vendorId: (formData.get("vendorId") as string) ?? "",
    itemName: (formData.get("itemName") as string) ?? "",
    quantity: (formData.get("quantity") as string) ?? "",
    unit: (formData.get("unit") as string) ?? "",
    rateRupees: (formData.get("rateRupees") as string) ?? "",
    discountPercent: (formData.get("discountPercent") as string) || "0",
    gstPercent: (formData.get("gstPercent") as string) || "0",
    destinationSiteId:
      (formData.get("destinationSiteId") as string) || undefined,
    paidByUserId: (formData.get("paidByUserId") as string) || undefined,
    purchaseDate: (formData.get("purchaseDate") as string) ?? "",
    billPhotoUrl: (formData.get("billPhotoUrl") as string) || undefined,
    billPhotoPublicId:
      (formData.get("billPhotoPublicId") as string) || undefined,
    note: (formData.get("note") as string) || undefined,
  };

  const parsed = PurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Resolve sentinel values
  const destinationSiteId =
    !parsed.data.destinationSiteId ||
    parsed.data.destinationSiteId === "CENTRAL_STORE"
      ? null
      : parsed.data.destinationSiteId;

  const paidByUserId =
    !parsed.data.paidByUserId || parsed.data.paidByUserId === "OWNER_DIRECT"
      ? null
      : parsed.data.paidByUserId;

  // Server-side total calculation (don't trust client)
  let ratePaise: bigint;
  try {
    ratePaise = toPaise(parsed.data.rateRupees);
  } catch {
    return { success: false, error: "Invalid rate value" };
  }

  const totalPaise = calcPurchaseTotalPaise(
    parsed.data.quantity,
    ratePaise,
    parsed.data.discountPercent,
    parsed.data.gstPercent
  );

  if (totalPaise <= 0n) {
    return { success: false, error: "Purchase total must be greater than ₹0" };
  }

  // Verify vendor exists
  const vendor = await db.vendor.findUnique({
    where: { id: parsed.data.vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) return { success: false, error: "Vendor not found" };

  // If wallet-paid, check balance before opening transaction
  if (paidByUserId) {
    const payer = await db.user.findUnique({
      where: { id: paidByUserId, isActive: true },
      select: { id: true },
    });
    if (!payer) return { success: false, error: "Payer not found or inactive" };

    const balance = await getWalletBalance(paidByUserId);
    if (balance < totalPaise) {
      return {
        success: false,
        error: "Insufficient wallet balance for this purchase",
      };
    }
  }

  let destinationSiteIdForRedirect: string | null = destinationSiteId;

  await db.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        vendorId: parsed.data.vendorId,
        itemName: parsed.data.itemName,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        ratePaise,
        discountPercent: parsed.data.discountPercent,
        gstPercent: parsed.data.gstPercent,
        totalPaise,
        destinationSiteId,
        paidByUserId,
        purchaseDate: new Date(parsed.data.purchaseDate),
        billPhotoUrl: parsed.data.billPhotoUrl || null,
        billPhotoPublicId: parsed.data.billPhotoPublicId || null,
        note: parsed.data.note ?? null,
        loggedById: currentUser.id,
      },
    });

    // Wallet debit — only if paid by a user (not owner-direct)
    if (paidByUserId) {
      await tx.walletTransaction.create({
        data: {
          actorUserId: paidByUserId,
          loggedById: currentUser.id,
          type: "VENDOR_PAYMENT",
          direction: "DEBIT",
          amountPaise: totalPaise,
          siteId: destinationSiteId,
          relatedPurchaseId: purchase.id,
          note: `Purchase from ${vendor.name}: ${parsed.data.itemName}`,
        },
      });
    }
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${parsed.data.vendorId}`);
  if (destinationSiteIdForRedirect) {
    revalidatePath(`/sites/${destinationSiteIdForRedirect}`);
  }

  // Redirect to vendor detail page
  redirect(`/vendors/${parsed.data.vendorId}`);
}

// ─── Void Purchase ────────────────────────────────────────────────────────────

type VoidResult = { success: false; error: string } | { success: true };

export async function voidPurchase(purchaseId: string): Promise<VoidResult> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can void purchases" };
  }

  const purchase = await db.purchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      vendorId: true,
      destinationSiteId: true,
      paidByUserId: true,
      totalPaise: true,
      voidedAt: true,
    },
  });

  if (!purchase) return { success: false, error: "Purchase not found" };
  if (purchase.voidedAt)
    return { success: false, error: "Purchase already voided" };

  await db.$transaction(async (tx) => {
    // Mark purchase as voided
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });

    // Reverse the wallet transaction if it was wallet-paid
    if (purchase.paidByUserId) {
      // Find the linked wallet transaction
      const walletTxn = await tx.walletTransaction.findFirst({
        where: { relatedPurchaseId: purchaseId, voidedAt: null },
        select: { id: true },
      });

      if (walletTxn) {
        // Void the original debit
        await tx.walletTransaction.update({
          where: { id: walletTxn.id },
          data: { voidedAt: new Date(), voidedById: currentUser.id },
        });

        // Credit back to the payer's wallet
        await tx.walletTransaction.create({
          data: {
            actorUserId: purchase.paidByUserId,
            loggedById: currentUser.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amountPaise: purchase.totalPaise,
            siteId: purchase.destinationSiteId,
            relatedPurchaseId: purchaseId,
            note: "Reversal: purchase voided",
          },
        });
      }
    }
  });

  revalidatePath(`/vendors/${purchase.vendorId}`);
  revalidatePath("/vendors");
  if (purchase.destinationSiteId) {
    revalidatePath(`/sites/${purchase.destinationSiteId}`);
  }

  return { success: true };
}
