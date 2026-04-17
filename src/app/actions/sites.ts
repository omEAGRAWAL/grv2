"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { toPaise } from "@/lib/money";

type ActionResult = { success: true } | { success: false; error: string };

const SiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  location: z.string().min(1, "Location is required").max(200),
  clientName: z.string().min(1, "Client name is required").max(100),
  contractValue: z.string().min(1, "Contract value is required"),
  startDate: z.string().min(1, "Start date is required"),
  expectedEndDate: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ON_HOLD"]).default("ACTIVE"),
});

function parseContractValue(raw: string): bigint | null {
  try {
    const paise = toPaise(raw);
    return paise >= 0n ? paise : null;
  } catch {
    return null;
  }
}

export async function createSite(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
    assertCan(owner, "create:site");
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    name: formData.get("name"),
    location: formData.get("location"),
    clientName: formData.get("clientName"),
    contractValue: formData.get("contractValue"),
    startDate: formData.get("startDate"),
    expectedEndDate: (formData.get("expectedEndDate") as string) || undefined,
    status: formData.get("status") || "ACTIVE",
  };

  const parsed = SiteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const contractValuePaise = parseContractValue(parsed.data.contractValue);
  if (contractValuePaise === null) {
    return { success: false, error: "Contract value must be non-negative" };
  }

  try {
    await db.site.create({
      data: {
        companyId: owner.effectiveCompanyId!,
        name: parsed.data.name,
        location: parsed.data.location,
        clientName: parsed.data.clientName,
        contractValuePaise,
        startDate: new Date(parsed.data.startDate),
        expectedEndDate: parsed.data.expectedEndDate
          ? new Date(parsed.data.expectedEndDate)
          : null,
        status: parsed.data.status,
      },
    });
  } catch {
    return { success: false, error: "Failed to create site" };
  }

  revalidatePath("/sites");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateSite(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let owner;
  try {
    owner = await requireOwner();
    assertCan(owner, "update:site");
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const siteId = formData.get("siteId") as string;
  if (!siteId) return { success: false, error: "Site ID missing" };

  const raw = {
    name: formData.get("name"),
    location: formData.get("location"),
    clientName: formData.get("clientName"),
    contractValue: formData.get("contractValue"),
    startDate: formData.get("startDate"),
    expectedEndDate: (formData.get("expectedEndDate") as string) || undefined,
    status: formData.get("status") || "ACTIVE",
  };

  const parsed = SiteSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const contractValuePaise = parseContractValue(parsed.data.contractValue);
  if (contractValuePaise === null) {
    return { success: false, error: "Contract value must be non-negative" };
  }

  try {
    await db.site.update({
      where: { id: siteId },
      data: {
        name: parsed.data.name,
        location: parsed.data.location,
        clientName: parsed.data.clientName,
        contractValuePaise,
        startDate: new Date(parsed.data.startDate),
        expectedEndDate: parsed.data.expectedEndDate
          ? new Date(parsed.data.expectedEndDate)
          : null,
        status: parsed.data.status,
      },
    });
  } catch {
    return { success: false, error: "Failed to update site" };
  }

  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}
