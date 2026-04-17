"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

type ActionResult =
  | { success: true; vendorId: string; vendorName: string }
  | { success: false; error: string };

// Standard GSTIN format: 15 chars
// ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const VendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required").max(100),
  contactPhone: z
    .string()
    .max(20)
    .optional()
    .transform((v) => v?.trim() || undefined),
  gstin: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined)
    .refine(
      (v) => !v || GSTIN_REGEX.test(v),
      "Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)"
    ),
  address: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v?.trim() || undefined),
  notes: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => v?.trim() || undefined),
});

export async function createVendor(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return { success: false, error: "Only owners can manage vendors" };
  }

  const raw = {
    name: (formData.get("name") as string) ?? "",
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    gstin: (formData.get("gstin") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = VendorSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const vendor = await db.vendor.create({
    data: {
      companyId: owner.effectiveCompanyId!,
      name: parsed.data.name,
      contactPhone: parsed.data.contactPhone ?? null,
      gstin: parsed.data.gstin ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/vendors");

  return { success: true, vendorId: vendor.id, vendorName: vendor.name };
}

export async function updateVendor(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireOwner();
  } catch {
    return { success: false, error: "Only owners can update vendors" };
  }

  const vendorId = (formData.get("vendorId") as string) ?? "";
  if (!vendorId) return { success: false, error: "Vendor ID is required" };

  const raw = {
    name: (formData.get("name") as string) ?? "",
    contactPhone: (formData.get("contactPhone") as string) || undefined,
    gstin: (formData.get("gstin") as string) || undefined,
    address: (formData.get("address") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = VendorSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const vendor = await db.vendor.update({
    where: { id: vendorId },
    data: {
      name: parsed.data.name,
      contactPhone: parsed.data.contactPhone ?? null,
      gstin: parsed.data.gstin ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");

  return { success: true, vendorId: vendor.id, vendorName: vendor.name };
}
