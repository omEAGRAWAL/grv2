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
  const note = formData.get("note") as string | null;

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

  try {
    await db.$transaction(async (tx) => {
      await tx.walletTransaction.create({
        data: {
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
