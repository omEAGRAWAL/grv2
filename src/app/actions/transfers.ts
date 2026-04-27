"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

type ActionResult = { success: false; error: string } | { success: true };

export async function createTransfer(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  const fromUserIdRaw = formData.get("fromUserId") as string;
  const toUserId = formData.get("toUserId") as string;
  const amountStr = formData.get("amountPaise") as string;
  const reason = (formData.get("reason") as string) || null;

  if (!toUserId) return { success: false, error: "Recipient is required" };
  if (!amountStr?.trim()) return { success: false, error: "Amount is required" };

  let amountPaise: bigint;
  try {
    amountPaise = BigInt(amountStr);
  } catch {
    return { success: false, error: "Invalid amount" };
  }

  if (amountPaise <= 0n) {
    return { success: false, error: "Amount must be greater than ₹0" };
  }

  // Only OWNER/SITE_MANAGER can transfer on behalf of others
  const canDelegate = currentUser.role === "OWNER" || currentUser.role === "SITE_MANAGER" || currentUser.role === "SUPERADMIN";
  const fromUserId =
    canDelegate && fromUserIdRaw
      ? fromUserIdRaw
      : currentUser.id;

  if (!canDelegate && fromUserIdRaw && fromUserIdRaw !== currentUser.id) {
    return { success: false, error: "You can only transfer from your own wallet" };
  }

  if (fromUserId === toUserId) {
    return { success: false, error: "Cannot transfer to yourself" };
  }

  const companyId = currentUser.effectiveCompanyId!;

  // Verify both users exist, are active, and belong to the same company
  const [fromUser, toUser] = await Promise.all([
    db.user.findFirst({ where: { id: fromUserId, isActive: true, companyId } }),
    db.user.findFirst({ where: { id: toUserId, isActive: true, companyId } }),
  ]);

  if (!fromUser) return { success: false, error: "Sender not found or inactive" };
  if (!toUser) return { success: false, error: "Recipient not found or inactive" };

  // Check balance
  const balance = await getWalletBalance(fromUserId);
  if (balance < amountPaise) {
    return { success: false, error: "Insufficient wallet balance" };
  }

  await db.$transaction(async (tx) => {
    await tx.walletTransaction.create({
      data: {
        companyId,
        actorUserId: fromUserId,
        loggedById: currentUser.id,
        type: "TRANSFER_OUT",
        direction: "DEBIT",
        amountPaise,
        counterpartyUserId: toUserId,
        note: reason?.trim() || null,
      },
    });
    await tx.walletTransaction.create({
      data: {
        companyId,
        actorUserId: toUserId,
        loggedById: currentUser.id,
        type: "TRANSFER_IN",
        direction: "CREDIT",
        amountPaise,
        counterpartyUserId: fromUserId,
        note: reason?.trim() || null,
      },
    });
  });

  return { success: true };
}
