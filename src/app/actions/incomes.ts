"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { toPaise } from "@/lib/money";

type ActionResult = { success: true } | { success: false; error: string };

const IncomeSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  amountRupees: z.string().min(1, "Amount is required").refine((v) => {
    try {
      return toPaise(v) > 0n;
    } catch {
      return false;
    }
  }, "Amount must be greater than ₹0"),
  receivedDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  type: z.enum(["ADVANCE", "RUNNING_BILL", "FINAL", "RETENTION"], {
    errorMap: () => ({ message: "Select a valid income type" }),
  }),
  note: z.string().max(500).optional(),
});

export async function createSiteIncome(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can log income" };
  }

  const raw = {
    siteId: (formData.get("siteId") as string) ?? "",
    amountRupees: (formData.get("amountRupees") as string) ?? "",
    receivedDate: (formData.get("receivedDate") as string) ?? "",
    type: (formData.get("type") as string) ?? "",
    note: (formData.get("note") as string) || undefined,
  };

  const parsed = IncomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  let amountPaise: bigint;
  try {
    amountPaise = toPaise(parsed.data.amountRupees);
  } catch {
    return { success: false, error: "Invalid amount" };
  }

  const site = await db.site.findUnique({
    where: { id: parsed.data.siteId },
    select: { id: true },
  });
  if (!site) return { success: false, error: "Site not found" };

  await db.$transaction(async (tx) => {
    await tx.siteIncome.create({
      data: {
        siteId: parsed.data.siteId,
        amountPaise,
        receivedDate: new Date(parsed.data.receivedDate),
        type: parsed.data.type,
        note: parsed.data.note ?? null,
        loggedById: owner.id,
      },
    });
  });

  revalidatePath(`/sites/${parsed.data.siteId}`);
  revalidatePath("/sites");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function voidSiteIncome(id: string): Promise<ActionResult> {
  let currentUser;
  try {
    currentUser = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can void income" };
  }

  const income = await db.siteIncome.findUnique({
    where: { id },
    select: { id: true, siteId: true, voidedAt: true },
  });

  if (!income) return { success: false, error: "Income record not found" };
  if (income.voidedAt) return { success: false, error: "Income already voided" };

  await db.$transaction(async (tx) => {
    await tx.siteIncome.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: currentUser.id },
    });
  });

  revalidatePath(`/sites/${income.siteId}`);
  revalidatePath("/sites");
  revalidatePath("/dashboard");
  return { success: true };
}
