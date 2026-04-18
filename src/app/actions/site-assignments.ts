"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

type ActionResult = { success: true } | { success: false; error: string };

const AssignSchema = z.object({
  siteId: z.string().min(1),
  userId: z.string().min(1),
});

export async function assignSupervisor(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const result = AssignSchema.safeParse({
    siteId: formData.get("siteId"),
    userId: formData.get("userId"),
  });
  if (!result.success) {
    return { success: false, error: "Invalid input" };
  }

  const { siteId, userId } = result.data;
  const companyId = caller.effectiveCompanyId ?? caller.companyId;

  // Verify site and user belong to the same company
  const [site, user] = await Promise.all([
    db.site.findFirst({ where: { id: siteId, companyId: companyId ?? undefined } }),
    db.user.findFirst({ where: { id: userId, companyId: companyId ?? undefined } }),
  ]);
  if (!site) return { success: false, error: "Site not found" };
  if (!user) return { success: false, error: "User not found" };
  if (!["SUPERVISOR", "SITE_MANAGER"].includes(user.role)) {
    return { success: false, error: "Only supervisors and site managers can be assigned" };
  }

  await db.siteAssignment.upsert({
    where: { userId_siteId: { userId, siteId } },
    create: { companyId: companyId!, userId, siteId },
    update: {},
  });

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}

export async function unassignSupervisor(
  siteId: string,
  userId: string
): Promise<ActionResult> {
  try {
    await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  await db.siteAssignment.deleteMany({ where: { siteId, userId } });

  revalidatePath(`/sites/${siteId}`);
  return { success: true };
}
