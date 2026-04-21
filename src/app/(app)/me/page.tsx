import { redirect } from "next/navigation";
import Link from "next/link";
import { Receipt, ArrowRightLeft, Info, Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { formatINR } from "@/lib/money";
import { getUnscopedDb } from "@/lib/db";

// Scoped by actorUserId (globally-unique UUID). Callers verify userId ownership.
const db = getUnscopedDb();
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "./logout-button";
import { WalletHistorySection } from "@/components/wallet/wallet-history-section";
import { ReconcileModal } from "@/components/wallet/reconcile-modal";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profile — ConstructHub" };

type Props = {
  searchParams: Promise<{ page?: string; type?: string; from?: string; to?: string }>;
};

async function getMonthSummary(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [creditAgg, debitAgg] = await Promise.all([
    db.walletTransaction.aggregate({
      _sum: { amountPaise: true },
      where: {
        actorUserId: userId,
        direction: "CREDIT",
        voidedAt: null,
        createdAt: { gte: startOfMonth },
      },
    }),
    db.walletTransaction.aggregate({
      _sum: { amountPaise: true },
      where: {
        actorUserId: userId,
        direction: "DEBIT",
        voidedAt: null,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    received: creditAgg._sum.amountPaise ?? 0n,
    spent: debitAgg._sum.amountPaise ?? 0n,
  };
}

export default async function MePage({ searchParams }: Props) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const sp = await searchParams;
  const companyId = user.effectiveCompanyId ?? user.companyId;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [walletBalance, monthSummary, attendanceSummary] = await Promise.all([
    getWalletBalance(user.id),
    getMonthSummary(user.id),
    companyId
      ? db.attendance.groupBy({
          by: ["status"],
          where: { companyId, userId: user.id, date: { gte: monthStart, lte: monthEnd } },
          _count: { status: true },
        })
      : Promise.resolve([]),
  ]);

  const attMap = Object.fromEntries(
    (attendanceSummary as { status: string; _count: { status: number } }[]).map((r) => [r.status, r._count.status])
  );
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Profile</h1>

      {/* Identity card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{user.name}</CardTitle>
            <Badge>{user.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            @{user.username}
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Joined</span>
            <span>
              {user.joinedAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{user.isActive ? "Active" : "Inactive"}</span>
          </div>
          {user.lastLoginAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last login</span>
              <span>
                {user.lastLoginAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet balance + quick actions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-1">
              Wallet Balance
              <span
                title="This balance is calculated from your transaction history. It is never stored separately."
                className="cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                aria-label="About wallet balance"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </CardTitle>
            <ReconcileModal userId={user.id} basePath="/me" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold tabular-nums">
            {formatINR(walletBalance)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/expense/new">
                <Receipt className="h-4 w-4" />
                Log Expense
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href="/transfer/new">
                <ArrowRightLeft className="h-4 w-4" />
                Send Money
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* This month summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Received this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-bold tabular-nums text-green-600">
              +{formatINR(monthSummary.received)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Spent this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-bold tabular-nums text-red-600">
              −{formatINR(monthSummary.spent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance this month */}
      {companyId && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-muted-foreground" />
                Attendance This Month
              </CardTitle>
              <Link href="/attendance/history" className="text-xs text-blue-600 underline">
                View history
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-green-600">{attMap["PRESENT"] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-600">{attMap["HALF_DAY"] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Half Day</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{attMap["ABSENT"] ?? 0}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet history */}
      <WalletHistorySection
        userId={user.id}
        basePath="/me"
        isOwner={user.role === "OWNER"}
        page={page}
        type={sp.type}
        from={sp.from}
        to={sp.to}
      />

      <LogoutButton />
    </div>
  );
}
