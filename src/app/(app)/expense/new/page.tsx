import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { ExpenseForm } from "@/components/expense/expense-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Log Expense — ConstructHub" };

type Props = { searchParams: Promise<{ site?: string }> };

async function getDefaultSiteId(userId: string, companyId: string): Promise<string | undefined> {
  // Try last-used site from this user's most recent non-voided txn (scoped to company)
  const last = await db.walletTransaction.findFirst({
    where: { actorUserId: userId, companyId, siteId: { not: null }, voidedAt: null },
    orderBy: { createdAt: "desc" },
    select: { siteId: true },
  });
  if (last?.siteId) return last.siteId;

  // Fall back to first active site in this company
  const first = await db.site.findFirst({
    where: { status: "ACTIVE", companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id;
}

export default async function ExpenseNewPage({ searchParams }: Props) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) redirect("/dashboard");

  const sp = await searchParams;

  const [sites, allActiveUsers, defaultSiteId] = await Promise.all([
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
      : Promise.resolve([]),
    getDefaultSiteId(user.id, companyId),
  ]);

  const resolvedDefaultSiteId = sp.site ?? defaultSiteId;

  // Fetch wallet balances for the form preview (owner needs all actors' balances)
  const actorIds =
    user.role === "OWNER" ? allActiveUsers.map((u) => u.id) : [user.id];
  const balanceEntries = await Promise.all(
    actorIds.map(async (id) => [id, (await getWalletBalance(id)).toString()] as [string, string])
  );
  const walletBalances = Object.fromEntries(balanceEntries);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link
          href="/me"
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">Log Expense</h1>
      </div>

      <div className="p-4 pb-24 max-w-md mx-auto">
        {sites.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center mt-4">
            <p className="text-sm font-medium">No active sites</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask the owner to create a site first.
            </p>
          </div>
        ) : (
          <ExpenseForm
            sites={sites}
            defaultSiteId={resolvedDefaultSiteId}
            actorUsers={allActiveUsers}
            currentUserId={user.id}
            walletBalances={walletBalances}
            isOwner={user.role === "OWNER"}
          />
        )}
      </div>
    </div>
  );
}
