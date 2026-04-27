import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { TransferFormPage } from "@/components/transfer/transfer-form-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Send Money — ConstructHub" };

export default async function TransferNewPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) redirect("/dashboard");

  const activeUsers = await db.user.findMany({
    where: { isActive: true, companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const balanceEntries = await Promise.all(
    activeUsers.map(async (u) => [u.id, (await getWalletBalance(u.id)).toString()] as [string, string])
  );
  const walletBalances = Object.fromEntries(balanceEntries);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Link
          href="/me"
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">Send Money</h1>
      </div>

      <div className="p-4 pb-24 max-w-md mx-auto">
        <TransferFormPage
          activeUsers={activeUsers}
          currentUserId={user.id}
          isOwner={user.role === "OWNER"}
          walletBalances={walletBalances}
        />
      </div>
    </div>
  );
}
