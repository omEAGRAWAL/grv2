"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUnscopedDb } from "@/lib/db";
import { getCurrentUser, getSession } from "@/lib/auth";

// SUPERADMIN: cross-tenant query intended — all operations in this file are superadmin-only
const db = getUnscopedDb();

type ActionResult = { success: true } | { success: false; error: string };

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (user.role !== "SUPERADMIN") {
    throw new Error("Forbidden: SUPERADMIN only");
  }
  return user;
}

export async function toggleCompanyStatus(
  companyId: string,
  currentStatus: string
): Promise<ActionResult> {
  try {
    await requireSuperadmin();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  await db.company.update({
    where: { id: companyId },
    data: { status: newStatus as "ACTIVE" | "SUSPENDED" },
  });

  revalidatePath("/super");
  return { success: true };
}

export async function impersonateCompany(companyId: string): Promise<void> {
  await requireSuperadmin();

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });

  if (!company) throw new Error("Company not found");
  if (company.status === "SUSPENDED") throw new Error("Company is suspended");

  const session = await getSession();
  session.impersonatingCompanyId = companyId;
  await session.save();

  redirect("/dashboard");
}

export async function stopImpersonating(): Promise<void> {
  const user = await getCurrentUser();
  if (user.role !== "SUPERADMIN") return;

  const session = await getSession();
  delete session.impersonatingCompanyId;
  await session.save();

  redirect("/super");
}
