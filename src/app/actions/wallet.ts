"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { toPaise } from "@/lib/money";

type ActionResult = { success: true } | { success: false; error: string };

export async function topUpWallet(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const employeeId = formData.get("employeeId") as string;
  const amountStr = formData.get("amount") as string;
  const noteRaw = formData.get("note") as string | null;
  const note = noteRaw?.slice(0, 200) || null;

  if (!employeeId) return { success: false, error: "Employee ID required" };
  if (!amountStr?.trim()) return { success: false, error: "Amount is required" };

  let amountPaise: bigint;
  try {
    amountPaise = toPaise(amountStr);
  } catch {
    return { success: false, error: "Invalid amount" };
  }

  if (amountPaise <= 0n) {
    return { success: false, error: "Amount must be greater than ₹0" };
  }

  const companyId = owner.effectiveCompanyId!;

  try {
    await db.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
          companyId,
          actorUserId: employeeId,
          loggedById: owner.id,
          type: "TOPUP",
          direction: "CREDIT",
          amountPaise,
          siteId: null,
          note: note?.trim() || null,
        },
      });
    });
  } catch (err) {
    console.error("[topUpWallet] DB error:", err);
    return { success: false, error: "Failed to process top-up" };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/me");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Void a wallet transaction (owner-only).
 * Marks the original voided and creates an opposite REVERSAL entry.
 * For TRANSFER_OUT/TRANSFER_IN pairs, voids both sides.
 */
export async function voidWalletTransaction(
  id: string
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can void transactions" };
  }

  const txn = await db.walletTransaction.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      actorUserId: true,
      loggedById: true,
      type: true,
      direction: true,
      amountPaise: true,
      siteId: true,
      counterpartyUserId: true,
      relatedPurchaseId: true,
      voidedAt: true,
      createdAt: true,
    },
  });

  if (!txn) return { success: false, error: "Transaction not found" };
  if (txn.companyId !== currentUser.effectiveCompanyId!) {
    return { success: false, error: "Transaction not found" };
  }
  if (txn.voidedAt) return { success: false, error: "Transaction already voided" };

  const oppositeDirection = txn.direction === "DEBIT" ? "CREDIT" : "DEBIT";

  // For transfer pairs: find the matching counterpart within 2 seconds
  let counterpartTxnId: string | null = null;
  if (
    (txn.type === "TRANSFER_OUT" || txn.type === "TRANSFER_IN") &&
    txn.counterpartyUserId
  ) {
    const counterpartType =
      txn.type === "TRANSFER_OUT" ? "TRANSFER_IN" : "TRANSFER_OUT";
    const windowStart = new Date(txn.createdAt.getTime() - 2000);
    const windowEnd = new Date(txn.createdAt.getTime() + 2000);

    const counterpart = await db.walletTransaction.findFirst({
      where: {
        companyId: txn.companyId,
        type: counterpartType,
        actorUserId: txn.counterpartyUserId,
        counterpartyUserId: txn.actorUserId,
        amountPaise: txn.amountPaise,
        voidedAt: null,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true },
    });
    // TODO: replace time-window lookup with a transferGroupId field (Phase 6)
    counterpartTxnId = counterpart?.id ?? null;
  }

  await db.$transaction(async (tx) => {
    // Void the original
    await tx.walletTransaction.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });

    // Create reversal for original
    await tx.walletTransaction.create({
      data: {
        companyId: txn.companyId,
        actorUserId: txn.actorUserId,
        loggedById: currentUser.id,
        type: "REVERSAL",
        direction: oppositeDirection,
        amountPaise: txn.amountPaise,
        siteId: txn.siteId,
        relatedPurchaseId: txn.relatedPurchaseId,
        note: `Reversal of ${txn.id}`,
      },
    });

    // For transfer pairs: also void the counterpart and create its reversal
    if (counterpartTxnId) {
      const counterpart = await tx.walletTransaction.findUnique({
        where: { id: counterpartTxnId },
        select: {
          actorUserId: true,
          direction: true,
          amountPaise: true,
          siteId: true,
        },
      });
      if (counterpart && !txn.voidedAt) {
        await tx.walletTransaction.update({
          where: { id: counterpartTxnId },
          data: { voidedAt: new Date(), voidedById: currentUser.id },
        });
        await tx.walletTransaction.create({
          data: {
            companyId: txn.companyId,
            actorUserId: counterpart.actorUserId,
            loggedById: currentUser.id,
            type: "REVERSAL",
            direction:
              counterpart.direction === "DEBIT" ? "CREDIT" : "DEBIT",
            amountPaise: counterpart.amountPaise,
            siteId: counterpart.siteId,
            note: `Reversal of ${counterpartTxnId}`,
          },
        });
      }
    }
  });

  // Revalidate affected pages
  revalidatePath("/me");
  revalidatePath(`/employees/${txn.actorUserId}`);
  if (txn.siteId) revalidatePath(`/sites/${txn.siteId}`);
  if (counterpartTxnId && txn.counterpartyUserId) {
    revalidatePath(`/employees/${txn.counterpartyUserId}`);
  }
  revalidatePath("/dashboard");
  return { success: true };
}
