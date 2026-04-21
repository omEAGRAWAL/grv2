import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWalletBalance } from "@/lib/wallet";
import { formatINR } from "@/lib/money";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeActionsMenu } from "@/components/employees/employee-actions-menu";
import { TopUpButton } from "@/components/employees/topup-button";
import { WalletHistorySection } from "@/components/wallet/wallet-history-section";
import { ReconcileModal } from "@/components/wallet/reconcile-modal";
import { PayrollTabSection } from "@/components/payroll/payroll-tab-section";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    type?: string;
    from?: string;
    to?: string;
    tab?: string;
  }>;
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

  const isOwner = currentUser.role === "OWNER";
  const isSiteManager = currentUser.role === "SITE_MANAGER";
  const isOwnerOrManager = isOwner || isSiteManager;

  // Employees can view their own payroll tab; others need OWNER/SITE_MANAGER
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "wallet";

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;

  if (!isOwnerOrManager && currentUser.id !== id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6">
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  const employee = await db.user.findFirst({
    where: { id, companyId: companyId ?? undefined },
  });
  if (!employee) notFound();

  const [walletBalance, monthSummary] = await Promise.all([
    getWalletBalance(employee.id),
    getMonthSummary(employee.id),
  ]);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const basePath = `/employees/${employee.id}`;

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
        {isOwnerOrManager && (
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
        )}
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
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
              Wallet
              <span
                title="Calculated from transaction history, never stored separately."
                className="cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                aria-label="About wallet balance"
              >
                <Info className="h-3 w-3" />
              </span>
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

      {/* Tab navigation */}
      <div className="flex border-b gap-1">
        {[
          { key: "wallet", label: "Wallet" },
          { key: "payroll", label: "Payroll" },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`${basePath}?tab=${key}`}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {tab === "payroll" ? (
        <PayrollTabSection
          userId={employee.id}
          employeeName={employee.name}
          walletBalancePaise={walletBalance.toString()}
          companyId={companyId!}
          basePath={basePath}
          isOwnerOrManager={isOwnerOrManager}
          page={page}
          from={sp.from}
          to={sp.to}
        />
      ) : (
        <>
          {isOwnerOrManager && (
            <div className="flex justify-end">
              <ReconcileModal userId={employee.id} basePath={basePath} />
            </div>
          )}
          <WalletHistorySection
            userId={employee.id}
            basePath={basePath}
            isOwner={isOwner}
            page={page}
            type={sp.type}
            from={sp.from}
            to={sp.to}
          />
        </>
      )}
    </div>
  );
}
