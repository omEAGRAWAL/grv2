"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import type { ExpenseCategory } from "@prisma/client";

type ActionResult = { success: false; error: string };

const VALID_CATEGORIES: ExpenseCategory[] = [
  "MATERIALS",
  "LABOR",
  "TRANSPORT",
  "FOOD",
  "MISC",
  "OTHER",
];

const ExpenseSchema = z.object({
  amountPaise: z.bigint().positive("Amount must be greater than ₹0"),
  siteId: z.string().min(1, "Site is required"),
  category: z.enum(
    ["MATERIALS", "LABOR", "TRANSPORT", "FOOD", "MISC", "OTHER"],
    { required_error: "Category is required" }
  ),
  note: z.string().max(200).optional(),
  billPhotoUrl: z.string().url().optional().or(z.literal("")),
  billPhotoPublicId: z.string().optional(),
  onBehalfOfUserId: z.string().optional(),
});

export async function createExpense(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult | never> {
  let currentUser;
  try {
    currentUser = await getCurrentUser();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  const amountStr = formData.get("amountPaise") as string;
  let amountPaise: bigint;
  try {
    amountPaise = BigInt(amountStr);
  } catch {
    return { success: false, error: "Invalid amount" };
  }

  const raw = {
    amountPaise,
    siteId: formData.get("siteId") as string,
    category: formData.get("category") as string,
    note: (formData.get("note") as string) || undefined,
    billPhotoUrl: (formData.get("billPhotoUrl") as string) || undefined,
    billPhotoPublicId:
      (formData.get("billPhotoPublicId") as string) || undefined,
    onBehalfOfUserId:
      (formData.get("onBehalfOfUserId") as string) || undefined,
  };

  const parsed = ExpenseSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Verify site exists
  const site = await db.site.findUnique({ where: { id: parsed.data.siteId } });
  if (!site) return { success: false, error: "Site not found" };

  // Determine actor — only OWNER can log on behalf of others
  let actorUserId = currentUser.id;
  if (parsed.data.onBehalfOfUserId) {
    if (currentUser.role !== "OWNER") {
      return {
        success: false,
        error: "Only owners can log expenses on behalf of others",
      };
    }
    actorUserId = parsed.data.onBehalfOfUserId;
  }

  // Check balance
  const balance = await getWalletBalance(actorUserId);
  if (balance < parsed.data.amountPaise) {
    return { success: false, error: "Insufficient wallet balance" };
  }

  await db.$transaction(async (tx) => {
    await tx.walletTransaction.create({
      data: {
        actorUserId,
        loggedById: currentUser.id,
        type: "EXPENSE",
        direction: "DEBIT",
        amountPaise: parsed.data.amountPaise,
        siteId: parsed.data.siteId,
        category: parsed.data.category as ExpenseCategory,
        note: parsed.data.note ?? null,
        billPhotoUrl: parsed.data.billPhotoUrl || null,
        billPhotoPublicId: parsed.data.billPhotoPublicId || null,
      },
    });
  });

  // Redirect: owner → site page; employee → /me
  if (currentUser.role === "OWNER") {
    redirect(`/sites/${parsed.data.siteId}`);
  }
  redirect("/me");
}
