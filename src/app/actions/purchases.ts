"use server";

import Decimal from "decimal.js";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, requireRole } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { toPaise } from "@/lib/money";
import { calcPurchaseTotalPaise } from "@/lib/purchase-math";
import type { PaymentStatus } from "@prisma/client";

type ActionResult = { success: false; error: string };

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// ─── Line item input (parsed from lineItemsJson) ──────────────────────────────

const LineItemInput = z.object({
  itemName: z.string().min(1, "Item name required").max(200),
  quantity: z.string().refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
    "Quantity must be greater than 0"
  ),
  unit: z.string().min(1, "Unit required").max(50),
  rateRupees: z.string().refine(
    (v) => { try { return toPaise(v) > 0n; } catch { return false; } },
    "Rate must be greater than ₹0"
  ),
  discountPercent: z.string().default("0").refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 100; },
    "Discount must be 0–100"
  ),
  gstPercent: z.string().default("0").refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 100; },
    "GST must be 0–100"
  ),
  materialId: z.string().optional(),
});

// ─── Purchase creation schema ─────────────────────────────────────────────────

const PurchaseSchema = z.object({
  purchaseType: z.enum(["VENDOR", "LOCAL"]).default("VENDOR"),
  vendorId: z.string().optional(),
  sellerName: z.string().max(200).optional(),
  lineItemsJson: z.string().min(1, "At least one line item is required"),
  destinationSiteId: z.string().optional(),
  purchaseDate: z
    .string()
    .min(1, "Purchase date is required")
    .refine((v) => !isNaN(Date.parse(v)), "Invalid purchase date"),
  billPhotoUrl: z.string().url().optional().or(z.literal("")),
  billPhotoPublicId: z.string().optional(),
  note: z.string().max(500).optional(),
  ipAmount: z.string().optional(),
  ipDate: z.string().optional(),
  ipMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]).optional(),
  ipPaidByUserId: z.string().optional(),
  ipProofUrl: z.string().url().optional().or(z.literal("")),
  ipProofPublicId: z.string().optional(),
  ipNotes: z.string().max(500).optional(),
});

function computePaymentStatus(amountPaidPaise: bigint, totalPaise: bigint): PaymentStatus {
  if (amountPaidPaise <= 0n) return "UNPAID";
  if (amountPaidPaise >= totalPaise) return "PAID";
  return "PARTIAL";
}

export async function createPurchase(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult | never> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can log purchases" };
  }

  const raw = {
    purchaseType: (formData.get("purchaseType") as string) || "VENDOR",
    vendorId: (formData.get("vendorId") as string) || undefined,
    sellerName: (formData.get("sellerName") as string) || undefined,
    lineItemsJson: (formData.get("lineItemsJson") as string) ?? "",
    destinationSiteId: (formData.get("destinationSiteId") as string) || undefined,
    purchaseDate: (formData.get("purchaseDate") as string) ?? "",
    billPhotoUrl: (formData.get("billPhotoUrl") as string) || undefined,
    billPhotoPublicId: (formData.get("billPhotoPublicId") as string) || undefined,
    note: (formData.get("note") as string) || undefined,
    ipAmount: (formData.get("ipAmount") as string) || undefined,
    ipDate: (formData.get("ipDate") as string) || undefined,
    ipMethod: (formData.get("ipMethod") as string) || undefined,
    ipPaidByUserId: (formData.get("ipPaidByUserId") as string) || undefined,
    ipProofUrl: (formData.get("ipProofUrl") as string) || undefined,
    ipProofPublicId: (formData.get("ipProofPublicId") as string) || undefined,
    ipNotes: (formData.get("ipNotes") as string) || undefined,
  };

  const parsed = PurchaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // ─── Parse + validate line items ──────────────────────────────────────────────
  let rawItems: unknown[];
  try {
    rawItems = JSON.parse(parsed.data.lineItemsJson);
    if (!Array.isArray(rawItems)) throw new Error();
  } catch {
    return { success: false, error: "Invalid line items" };
  }
  if (rawItems.length === 0) return { success: false, error: "At least one line item is required" };
  if (rawItems.length > 20) return { success: false, error: "Maximum 20 line items per purchase" };

  type ValidatedItem = {
    item: z.infer<typeof LineItemInput>;
    ratePaise: bigint;
    lineTotalPaise: bigint;
  };
  const lineItems: ValidatedItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const itemParsed = LineItemInput.safeParse(rawItems[i]);
    if (!itemParsed.success) {
      return { success: false, error: `Row ${i + 1}: ${itemParsed.error.issues[0].message}` };
    }
    let ratePaise: bigint;
    try {
      ratePaise = toPaise(itemParsed.data.rateRupees);
    } catch {
      return { success: false, error: `Row ${i + 1}: Invalid rate` };
    }
    const lineTotalPaise = calcPurchaseTotalPaise(
      itemParsed.data.quantity,
      ratePaise,
      itemParsed.data.discountPercent,
      itemParsed.data.gstPercent
    );
    if (lineTotalPaise <= 0n) return { success: false, error: `Row ${i + 1}: Line total must be > ₹0` };
    lineItems.push({ item: itemParsed.data, ratePaise, lineTotalPaise });
  }

  const totalPaise = lineItems.reduce((s, li) => s + li.lineTotalPaise, 0n);
  if (totalPaise <= 0n) return { success: false, error: "Purchase total must be greater than ₹0" };

  const companyId = currentUser.effectiveCompanyId!;
  const purchaseType = parsed.data.purchaseType;

  // ─── Vendor / source validation ───────────────────────────────────────────────
  let vendor: { id: string; name: string } | null = null;
  if (purchaseType === "VENDOR") {
    if (!parsed.data.vendorId) return { success: false, error: "Vendor is required" };
    vendor = await db.vendor.findFirst({
      where: { id: parsed.data.vendorId, companyId },
      select: { id: true, name: true },
    });
    if (!vendor) return { success: false, error: "Vendor not found" };
  }

  // ─── Material IDs isolation check ─────────────────────────────────────────────
  const materialIds = lineItems.flatMap((li) => (li.item.materialId ? [li.item.materialId] : []));
  if (materialIds.length > 0) {
    const found = await db.material.findMany({
      where: { id: { in: materialIds }, companyId },
      select: { id: true },
    });
    if (found.length !== materialIds.length) {
      return { success: false, error: "One or more materials not found" };
    }
  }

  const destinationSiteId =
    !parsed.data.destinationSiteId || parsed.data.destinationSiteId === "CENTRAL_STORE"
      ? null
      : parsed.data.destinationSiteId;

  // ─── Initial payment ──────────────────────────────────────────────────────────
  let ipAmountPaise = 0n;
  if (parsed.data.ipAmount) {
    try {
      ipAmountPaise = toPaise(parsed.data.ipAmount);
    } catch {
      return { success: false, error: "Invalid initial payment amount" };
    }
  }

  const hasInitialPayment = ipAmountPaise > 0n;
  const ipDate = parsed.data.ipDate ? new Date(parsed.data.ipDate) : new Date();
  const ipMethod = parsed.data.ipMethod ?? "CASH";
  const ipPaidByUserId =
    !parsed.data.ipPaidByUserId || parsed.data.ipPaidByUserId === "OWNER_DIRECT"
      ? null
      : parsed.data.ipPaidByUserId;

  if (hasInitialPayment && ipAmountPaise > totalPaise) {
    return { success: false, error: "Initial payment cannot exceed purchase total" };
  }

  if (hasInitialPayment && ipPaidByUserId) {
    const payer = await db.user.findFirst({
      where: { id: ipPaidByUserId, isActive: true, companyId },
      select: { id: true },
    });
    if (!payer) return { success: false, error: "Payer not found or inactive" };
    const balance = await getWalletBalance(ipPaidByUserId);
    if (balance < ipAmountPaise) {
      return { success: false, error: "Insufficient wallet balance for this payment" };
    }
  }

  const paymentStatus = computePaymentStatus(ipAmountPaise, totalPaise);

  const firstItemLabel =
    lineItems.length === 1
      ? lineItems[0].item.itemName
      : `${lineItems[0].item.itemName} +${lineItems.length - 1} more`;
  const sourceLabel = vendor?.name ?? parsed.data.sellerName ?? "LOCAL purchase";

  let createdPurchaseId = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  await anyDb.$transaction(async (tx: any) => {
    const purchase = await tx.purchase.create({
      data: {
        companyId,
        purchaseType,
        vendorId: vendor?.id ?? null,
        sellerName: purchaseType === "LOCAL" ? (parsed.data.sellerName || null) : null,
        totalPaise,
        destinationSiteId,
        paymentStatus,
        purchaseDate: new Date(parsed.data.purchaseDate),
        billPhotoUrl: parsed.data.billPhotoUrl || null,
        billPhotoPublicId: parsed.data.billPhotoPublicId || null,
        note: parsed.data.note ?? null,
        loggedById: currentUser.id,
      },
    });
    createdPurchaseId = purchase.id;

    for (let i = 0; i < lineItems.length; i++) {
      const { item, ratePaise, lineTotalPaise } = lineItems[i];
      await tx.purchaseLineItem.create({
        data: {
          companyId,
          purchaseId: purchase.id,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          ratePaise,
          discountPercent: item.discountPercent,
          gstPercent: item.gstPercent,
          lineTotalPaise,
          displayOrder: i,
          materialId: item.materialId || null,
        },
      });
    }

    if (hasInitialPayment) {
      let walletTxnId: string | null = null;

      if (ipPaidByUserId) {
        const walletTxn = await tx.walletTransaction.create({
          data: {
            companyId,
            actorUserId: ipPaidByUserId,
            loggedById: currentUser.id,
            type: "VENDOR_PAYMENT",
            direction: "DEBIT",
            amountPaise: ipAmountPaise,
            siteId: destinationSiteId,
            relatedPurchaseId: purchase.id,
            paymentDate: ipDate,
            note: `Purchase from ${sourceLabel}: ${firstItemLabel}`,
          },
        });
        walletTxnId = walletTxn.id;
      }

      await tx.purchasePayment.create({
        data: {
          companyId,
          purchaseId: purchase.id,
          amountPaidPaise: ipAmountPaise,
          paidDate: ipDate,
          paidByUserId: ipPaidByUserId,
          paymentMethod: ipMethod as "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER",
          paymentProofUrl: parsed.data.ipProofUrl || null,
          paymentProofPublicId: parsed.data.ipProofPublicId || null,
          notes: parsed.data.ipNotes || null,
          loggedById: currentUser.id,
          relatedWalletTxnId: walletTxnId,
        },
      });
    }
  });

  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  if (vendor) {
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${vendor.id}`);
  }
  if (destinationSiteId) revalidatePath(`/sites/${destinationSiteId}`);

  if (purchaseType === "VENDOR" && vendor) {
    redirect(`/vendors/${vendor.id}`);
  } else {
    redirect(`/purchases/${createdPurchaseId}`);
  }
}

// ─── Add Purchase Payment ─────────────────────────────────────────────────────

type AddPaymentResult = { success: false; error: string } | { success: true };

const AddPaymentSchema = z.object({
  purchaseId: z.string().min(1),
  amountRupees: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => {
      try {
        return toPaise(v) > 0n;
      } catch {
        return false;
      }
    }, "Amount must be greater than ₹0"),
  paidDate: z
    .string()
    .min(1, "Payment date is required")
    .refine((v) => !isNaN(Date.parse(v)), "Invalid payment date"),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  paidByUserId: z.string().optional(),
  proofUrl: z.string().url().optional().or(z.literal("")),
  proofPublicId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export async function addPurchasePayment(
  _prevState: AddPaymentResult | null,
  formData: FormData
): Promise<AddPaymentResult> {
  let currentUser;
  try {
    currentUser = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const companyId = currentUser.effectiveCompanyId!;

  const raw = {
    purchaseId: (formData.get("purchaseId") as string) ?? "",
    amountRupees: (formData.get("amountRupees") as string) ?? "",
    paidDate: (formData.get("paidDate") as string) ?? "",
    paymentMethod: (formData.get("paymentMethod") as string) ?? "",
    paidByUserId: (formData.get("paidByUserId") as string) || undefined,
    proofUrl: (formData.get("proofUrl") as string) || undefined,
    proofPublicId: (formData.get("proofPublicId") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = AddPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const paidByUserId =
    !parsed.data.paidByUserId || parsed.data.paidByUserId === "OWNER_DIRECT"
      ? null
      : parsed.data.paidByUserId;

  let amountPaise: bigint;
  try {
    amountPaise = toPaise(parsed.data.amountRupees);
  } catch {
    return { success: false, error: "Invalid payment amount" };
  }

  const purchaseFull = await db.purchase.findFirst({
    where: { id: parsed.data.purchaseId, companyId, voidedAt: null },
    include: {
      payments: { where: { voidedAt: null }, select: { amountPaidPaise: true } },
      vendor: { select: { name: true } },
    },
  });
  if (!purchaseFull) return { success: false, error: "Purchase not found" };

  const totalPaid = purchaseFull.payments.reduce(
    (sum, p) => sum + p.amountPaidPaise,
    0n
  );
  const remaining = purchaseFull.totalPaise - totalPaid;

  if (amountPaise > remaining) {
    return {
      success: false,
      error: `Payment of ${amountPaise / 100n} exceeds remaining due of ${remaining / 100n} paise`,
    };
  }

  if (paidByUserId) {
    const payer = await db.user.findFirst({
      where: { id: paidByUserId, isActive: true, companyId },
      select: { id: true },
    });
    if (!payer) return { success: false, error: "Payer not found or inactive" };

    const isOwner = await db.user.findFirst({
      where: { id: paidByUserId, role: "OWNER", companyId },
      select: { id: true },
    });
    if (!isOwner) {
      const balance = await getWalletBalance(paidByUserId);
      if (balance < amountPaise) {
        return { success: false, error: "Insufficient wallet balance" };
      }
    }
  }

  // Safe label for wallet note (vendor may be null for LOCAL purchases)
  const itemLabel = (purchaseFull as any).itemName ?? "(items)";
  const vendorLabel =
    purchaseFull.vendor?.name ?? (purchaseFull as any).sellerName ?? "LOCAL purchase";

  await db.$transaction(async (tx) => {
    let walletTxnId: string | null = null;

    if (paidByUserId) {
      const walletTxn = await tx.walletTransaction.create({
        data: {
          companyId,
          actorUserId: paidByUserId,
          loggedById: currentUser.id,
          type: "VENDOR_PAYMENT",
          direction: "DEBIT",
          amountPaise,
          siteId: purchaseFull.destinationSiteId,
          relatedPurchaseId: purchaseFull.id,
          paymentDate: new Date(parsed.data.paidDate),
          note: `Payment for ${itemLabel} (${vendorLabel})`,
        },
      });
      walletTxnId = walletTxn.id;
    }

    await tx.purchasePayment.create({
      data: {
        companyId,
        purchaseId: purchaseFull.id,
        amountPaidPaise: amountPaise,
        paidDate: new Date(parsed.data.paidDate),
        paidByUserId,
        paymentMethod: parsed.data.paymentMethod,
        paymentProofUrl: parsed.data.proofUrl || null,
        paymentProofPublicId: parsed.data.proofPublicId || null,
        notes: parsed.data.notes || null,
        loggedById: currentUser.id,
        relatedWalletTxnId: walletTxnId,
      },
    });

    const newTotalPaid = totalPaid + amountPaise;
    const newStatus = computePaymentStatus(newTotalPaid, purchaseFull.totalPaise);
    await tx.purchase.update({
      where: { id: purchaseFull.id },
      data: { paymentStatus: newStatus },
    });
  });

  revalidatePath(`/purchases/${purchaseFull.id}`);
  revalidatePath("/purchases");
  if (purchaseFull.vendorId) revalidatePath(`/vendors/${purchaseFull.vendorId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

// ─── Void Purchase Payment ────────────────────────────────────────────────────

type VoidPaymentResult = { success: false; error: string } | { success: true };

export async function voidPurchasePayment(paymentId: string): Promise<VoidPaymentResult> {
  let currentUser;
  try {
    currentUser = await requireRole(["OWNER"]);
  } catch {
    return { success: false, error: "Only owners can void payments" };
  }

  const companyId = currentUser.effectiveCompanyId!;

  const payment = await db.purchasePayment.findFirst({
    where: { id: paymentId, companyId },
    include: {
      purchase: { select: { id: true, totalPaise: true, vendorId: true, destinationSiteId: true } },
    },
  });

  if (!payment) return { success: false, error: "Payment not found" };
  if (payment.voidedAt) return { success: false, error: "Payment already voided" };

  await db.$transaction(async (tx) => {
    await tx.purchasePayment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });

    if (payment.relatedWalletTxnId && payment.paidByUserId) {
      await tx.walletTransaction.update({
        where: { id: payment.relatedWalletTxnId },
        data: { voidedAt: new Date(), voidedById: currentUser.id },
      });
      await tx.walletTransaction.create({
        data: {
          companyId,
          actorUserId: payment.paidByUserId,
          loggedById: currentUser.id,
          type: "REVERSAL",
          direction: "CREDIT",
          amountPaise: payment.amountPaidPaise,
          siteId: payment.purchase.destinationSiteId,
          relatedPurchaseId: payment.purchase.id,
          note: "Reversal: payment voided",
        },
      });
    }

    const remaining = await tx.purchasePayment.findMany({
      where: { purchaseId: payment.purchase.id, voidedAt: null, id: { not: paymentId } },
      select: { amountPaidPaise: true },
    });
    const newTotalPaid = remaining.reduce((s, p) => s + p.amountPaidPaise, 0n);
    const newStatus = computePaymentStatus(newTotalPaid, payment.purchase.totalPaise);
    await tx.purchase.update({
      where: { id: payment.purchase.id },
      data: { paymentStatus: newStatus },
    });
  });

  revalidatePath(`/purchases/${payment.purchase.id}`);
  revalidatePath("/purchases");
  if (payment.purchase.vendorId) revalidatePath(`/vendors/${payment.purchase.vendorId}`);
  revalidatePath("/dashboard");

  return { success: true };
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
    include: {
      payments: {
        where: { voidedAt: null },
        select: { id: true, paidByUserId: true, amountPaidPaise: true, relatedWalletTxnId: true },
      },
    },
  });

  if (!purchase) return { success: false, error: "Purchase not found" };
  if (purchase.companyId !== currentUser.effectiveCompanyId!) {
    return { success: false, error: "Purchase not found" };
  }
  if (purchase.voidedAt) return { success: false, error: "Purchase already voided" };

  await db.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });

    for (const payment of purchase.payments) {
      await tx.purchasePayment.update({
        where: { id: payment.id },
        data: { voidedAt: new Date(), voidedById: currentUser.id },
      });

      if (payment.relatedWalletTxnId && payment.paidByUserId) {
        await tx.walletTransaction.update({
          where: { id: payment.relatedWalletTxnId },
          data: { voidedAt: new Date(), voidedById: currentUser.id },
        });
        await tx.walletTransaction.create({
          data: {
            companyId: purchase.companyId,
            actorUserId: payment.paidByUserId,
            loggedById: currentUser.id,
            type: "REVERSAL",
            direction: "CREDIT",
            amountPaise: payment.amountPaidPaise,
            siteId: purchase.destinationSiteId,
            relatedPurchaseId: purchaseId,
            note: "Reversal: purchase voided",
          },
        });
      }
    }

    // Legacy v1 path: paidByUserId on Purchase itself, no PurchasePayment rows
    if ((purchase as any).paidByUserId && purchase.payments.length === 0) {
      const walletTxn = await tx.walletTransaction.findFirst({
        where: { relatedPurchaseId: purchaseId, voidedAt: null },
        select: { id: true },
      });
      if (walletTxn) {
        await tx.walletTransaction.update({
          where: { id: walletTxn.id },
          data: { voidedAt: new Date(), voidedById: currentUser.id },
        });
        await tx.walletTransaction.create({
          data: {
            companyId: purchase.companyId,
            actorUserId: (purchase as any).paidByUserId,
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

  if (purchase.vendorId) {
    revalidatePath(`/vendors/${purchase.vendorId}`);
    revalidatePath("/vendors");
  }
  revalidatePath("/purchases");
  revalidatePath("/dashboard");
  if (purchase.destinationSiteId) revalidatePath(`/sites/${purchase.destinationSiteId}`);

  return { success: true };
}
