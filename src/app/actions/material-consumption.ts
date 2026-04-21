"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type ConsumptionActionResult =
  | { success: true; count?: number }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ─── Permission helper ────────────────────────────────────────────────────────

async function canConsumeAtSite(
  caller: { id: string; role: string; companyId: string | null; effectiveCompanyId?: string },
  siteId: string
): Promise<boolean> {
  if (["OWNER", "SITE_MANAGER"].includes(caller.role)) return true;
  if (caller.role === "SUPERVISOR") {
    const companyId = caller.effectiveCompanyId ?? caller.companyId;
    const assignment = await db.siteAssignment.findFirst({
      where: { userId: caller.id, siteId, ...(companyId ? { companyId } : {}) },
    });
    return assignment !== null;
  }
  return false;
}

// ─── Single consumption ───────────────────────────────────────────────────────

const SingleSchema = z.object({
  siteId: z.string().min(1),
  itemName: z.string().min(1, "Item name is required").max(100),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(20),
  consumedDate: z.string().min(1, "Date is required"),
  note: z.string().max(200).optional(),
});

export async function createConsumption(
  _prev: ConsumptionActionResult | null,
  formData: FormData
): Promise<ConsumptionActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    siteId: formData.get("siteId"),
    itemName: formData.get("itemName"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    consumedDate: formData.get("consumedDate"),
    note: (formData.get("note") as string) || undefined,
  };

  const parsed = SingleSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!(await canConsumeAtSite(caller, parsed.data.siteId))) {
    return { success: false, error: "You are not assigned to this site" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId!;

  try {
    await db.materialConsumption.create({
      data: {
        companyId,
        siteId: parsed.data.siteId,
        itemName: parsed.data.itemName.trim(),
        quantity: parsed.data.quantity,
        unit: parsed.data.unit.trim(),
        consumedDate: new Date(parsed.data.consumedDate),
        note: parsed.data.note ?? null,
        loggedById: caller.id,
      },
    });
  } catch {
    return { success: false, error: "Failed to log consumption" };
  }

  revalidatePath(`/sites/${parsed.data.siteId}`);
  revalidatePath(`/sites/${parsed.data.siteId}/consume`);
  return { success: true, count: 1 };
}

// ─── Bulk consumption ─────────────────────────────────────────────────────────

interface BulkRow {
  itemName: string;
  quantity: string;
  unit: string;
}

const BulkRowSchema = z.object({
  itemName: z.string().min(1).max(100),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1).max(20),
});

export async function bulkConsumption(
  siteId: string,
  rows: BulkRow[],
  consumedDate: string,
  note?: string
): Promise<ConsumptionActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  if (!(await canConsumeAtSite(caller, siteId))) {
    return { success: false, error: "You are not assigned to this site" };
  }

  if (!rows.length) return { success: false, error: "No rows to submit" };
  if (rows.length > 50) return { success: false, error: "Maximum 50 rows" };

  // Validate all rows first
  const fieldErrors: Record<string, string> = {};
  const validatedRows: { itemName: string; quantity: number; unit: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = BulkRowSchema.safeParse(rows[i]);
    if (!result.success) {
      fieldErrors[`row_${i}`] = result.error.issues[0].message;
    } else {
      validatedRows.push(result.data);
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: "Validation errors in rows", fieldErrors };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId!;
  const date = new Date(consumedDate);

  try {
    await db.$transaction(
      validatedRows.map((row) =>
        db.materialConsumption.create({
          data: {
            companyId,
            siteId,
            itemName: row.itemName.trim(),
            quantity: row.quantity,
            unit: row.unit.trim(),
            consumedDate: date,
            note: note ?? null,
            loggedById: caller.id,
          },
        })
      )
    );
  } catch {
    return { success: false, error: "Failed to log consumption — transaction rolled back" };
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/consume`);
  return { success: true, count: validatedRows.length };
}

// ─── Void ─────────────────────────────────────────────────────────────────────

export async function voidConsumption(consumptionId: string): Promise<ConsumptionActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.materialConsumption.findUnique({
    where: { id: consumptionId },
  });
  if (!existing || existing.voidedAt) {
    return { success: false, error: "Record not found" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (existing.companyId !== companyId) {
    return { success: false, error: "Not in your company" };
  }

  try {
    await db.materialConsumption.update({
      where: { id: consumptionId },
      data: { voidedAt: new Date(), voidedById: caller.id },
    });
  } catch {
    return { success: false, error: "Failed to void" };
  }

  revalidatePath(`/sites/${existing.siteId}`);
  revalidatePath(`/sites/${existing.siteId}/consume`);
  return { success: true };
}
