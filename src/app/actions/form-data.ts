"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";

export async function getExpenseFormData() {
  const user = await getCurrentUser();
  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) throw new Error("No company");

  const [sites, allActiveUsers] = await Promise.all([
    db.site.findMany({
      where: { status: "ACTIVE", companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    user.role === "OWNER"
      ? db.user.findMany({
          where: { isActive: true, companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  // Default site: last-used or first active
  const last = await db.walletTransaction.findFirst({
    where: { actorUserId: user.id, companyId, siteId: { not: null }, voidedAt: null },
    orderBy: { createdAt: "desc" },
    select: { siteId: true },
  });
  const defaultSiteId =
    last?.siteId ??
    (await db.site.findFirst({
      where: { status: "ACTIVE", companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }))?.id;

  const actorIds = user.role === "OWNER" ? allActiveUsers.map((u) => u.id) : [user.id];
  const balanceEntries = await Promise.all(
    actorIds.map(async (id) => [id, (await getWalletBalance(id)).toString()] as [string, string])
  );
  const walletBalances = Object.fromEntries(balanceEntries);

  return {
    sites,
    actorUsers: allActiveUsers,
    walletBalances,
    currentUserId: user.id,
    isOwner: user.role === "OWNER",
    defaultSiteId,
  };
}

export async function getTransferFormData() {
  const user = await getCurrentUser();
  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) throw new Error("No company");

  const activeUsers = await db.user.findMany({
    where: { isActive: true, companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const balanceEntries = await Promise.all(
    activeUsers.map(async (u) => [u.id, (await getWalletBalance(u.id)).toString()] as [string, string])
  );
  const walletBalances = Object.fromEntries(balanceEntries);

  return {
    activeUsers,
    walletBalances,
    currentUserId: user.id,
    isOwner: user.role === "OWNER",
  };
}
