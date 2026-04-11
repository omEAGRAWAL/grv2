import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeActionsMenu } from "@/components/employees/employee-actions-menu";
import { TopUpButton } from "@/components/employees/topup-button";
import { WalletHistorySection } from "@/components/wallet/wallet-history-section";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; type?: string; from?: string; to?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  return { title: user ? `${user.name} — ConstructHub` : "Employee" };
}

async function getMonthSummary(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [creditAgg, debitAgg] = await Promise.all([
    db.walletTransaction.aggregate({
      _sum: { amountPaise: true },
      where: { actorUserId: userId, direction: "CREDIT", voidedAt: null, createdAt: { gte: startOfMonth } },
    }),
    db.walletTransaction.aggregate({
      _sum: { amountPaise: true },
      where: { actorUserId: userId, direction: "DEBIT", voidedAt: null, createdAt: { gte: startOfMonth } },
    }),
  ]);
  return {
    received: creditAgg._sum.amountPaise ?? 0n,
    spent: debitAgg._sum.amountPaise ?? 0n,
  };
}

export default async function EmployeeDetailPage({ params, searchParams }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6">
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">Only owners can view employee details.</p>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const employee = await db.user.findUnique({ where: { id, role: "EMPLOYEE" } });
  if (!employee) notFound();

  const [walletBalance, monthSummary] = await Promise.all([
    getWalletBalance(employee.id),
    getMonthSummary(employee.id),
  ]);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{employee.name}</h1>
            <Badge variant={employee.isActive ? "default" : "secondary"}>
              {employee.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">
            @{employee.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TopUpButton
            employeeId={employee.id}
            employeeName={employee.name}
            walletBalancePaise={walletBalance.toString()}
          />
          <EmployeeActionsMenu
            userId={employee.id}
            userName={employee.name}
            isActive={employee.isActive}
            walletBalancePaise={walletBalance.toString()}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Joined
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-sm">
              {employee.joinedAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold tabular-nums">{formatINR(walletBalance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Received (mo.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold tabular-nums text-green-600">
              +{formatINR(monthSummary.received)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Spent (mo.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold tabular-nums text-red-600">
              −{formatINR(monthSummary.spent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Wallet history */}
      <WalletHistorySection
        userId={employee.id}
        basePath={`/employees/${employee.id}`}
        isOwner={true}
        page={page}
        type={sp.type}
        from={sp.from}
        to={sp.to}
      />
    </div>
  );
}
