import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Wallet, TrendingUp, AlertTriangle, AlertCircle, Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getCashWithTeam } from "@/lib/wallet";
import { getSites } from "@/lib/sites";
import { formatINR } from "@/lib/money";
import { db } from "@/lib/db";
import { getBatchSiteSpend } from "@/lib/site-financials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateSiteDialog } from "@/components/sites/create-site-dialog";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

async function getDashboardStats(companyId?: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const cFilter = companyId ? { companyId } : {};

  const [activeSiteCount, cashWithTeam, incomeAgg, walletOutAgg, ownerDirectPurchaseAgg] =
    await Promise.all([
      db.site.count({ where: { status: "ACTIVE", ...cFilter } }),
      getCashWithTeam(companyId),
      db.siteIncome.aggregate({
        _sum: { amountPaise: true },
        where: { createdAt: { gte: startOfMonth }, voidedAt: null, ...cFilter },
      }),
      db.walletTransaction.aggregate({
        _sum: { amountPaise: true },
        where: {
          direction: "DEBIT",
          type: { in: ["EXPENSE", "VENDOR_PAYMENT"] },
          createdAt: { gte: startOfMonth },
          voidedAt: null,
          ...cFilter,
        },
      }),
      db.purchase.aggregate({
        _sum: { totalPaise: true },
        where: {
          paidByUserId: null,
          createdAt: { gte: startOfMonth },
          voidedAt: null,
          ...cFilter,
        },
      }),
    ]);

  return {
    activeSiteCount,
    cashWithTeam,
    monthlyIn: incomeAgg._sum.amountPaise ?? 0n,
    monthlyOut:
      (walletOutAgg._sum.amountPaise ?? 0n) +
      (ownerDirectPurchaseAgg._sum.totalPaise ?? 0n),
  };
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export default async function DashboardPage() {
  let user: { id: string; name: string; role: string; onboardingDismissedAt: Date | null; effectiveCompanyId?: string; companyId: string | null };
  try {
    const u = await getCurrentUser();
    user = {
      id: u.id,
      name: u.name,
      role: u.role,
      onboardingDismissedAt: u.onboardingDismissedAt ?? null,
      effectiveCompanyId: u.effectiveCompanyId,
      companyId: u.companyId,
    };
  } catch {
    redirect("/login");
  }

  const companyId = user.effectiveCompanyId ?? user.companyId ?? undefined;

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [stats, allSites, myTodayAttendance, todayAttendanceSummary] = await Promise.all([
    getDashboardStats(companyId),
    getSites({ companyId, userId: user.id, role: user.role }),
    companyId
      ? db.attendance.findUnique({
          where: { companyId_userId_date: { companyId, userId: user.id, date: todayDate } },
          select: { status: true },
        })
      : Promise.resolve(null),
    (companyId && (user.role === "OWNER" || user.role === "SITE_MANAGER"))
      ? db.attendance.count({ where: { companyId, date: todayDate, status: "PRESENT" } })
        .then(async (presentCount) => {
          const total = await db.user.count({
            where: { companyId, isActive: true, role: { notIn: ["OWNER", "SUPERADMIN"] } },
          });
          return { presentCount, total };
        })
      : Promise.resolve(null),
  ]);

  // Onboarding checklist — show only for owners who haven't dismissed it
  let showOnboarding = false;
  let onboardingState = { hasSite: false, hasEmployee: false, hasTopUp: false };

  if (user.role === "OWNER" && !user.onboardingDismissedAt) {
    const cFilter = companyId ? { companyId } : {};
    const [siteCount, employeeCount, topUpCount] = await Promise.all([
      db.site.count({ where: { ...cFilter } }),
      db.user.count({ where: { role: "EMPLOYEE", ...cFilter } }),
      db.walletTransaction.count({ where: { type: "TOPUP", ...cFilter } }),
    ]);
    showOnboarding = true;
    onboardingState = {
      hasSite: siteCount > 0,
      hasEmployee: employeeCount > 0,
      hasTopUp: topUpCount > 0,
    };
  }

  const topSites = allSites.slice(0, 5);

  // Recent site updates (owner only)
  type RecentUpdate = {
    id: string;
    siteId: string;
    siteName: string;
    workDone: string;
    submitterName: string;
    createdAt: Date;
  };
  let recentUpdates: RecentUpdate[] = [];
  if (user.role === "OWNER" && companyId) {
    const raw = await db.siteUpdate.findMany({
      where: { companyId, voidedAt: null },
      include: {
        submittedBy: { select: { name: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    recentUpdates = raw.map((u) => ({
      id: u.id,
      siteId: u.site.id,
      siteName: u.site.name,
      workDone: u.workDone,
      submitterName: u.submittedBy.name,
      createdAt: u.createdAt,
    }));
  }

  // Budget warnings — only for owners, only ACTIVE sites
  type BudgetWarning = {
    siteId: string;
    siteName: string;
    pct: number;
    overrun: boolean;
  };
  let budgetWarnings: BudgetWarning[] = [];

  if (user.role === "OWNER") {
    const activeSites = allSites.filter((s) => s.status === "ACTIVE");
    if (activeSites.length > 0) {
      const siteIds = activeSites.map((s) => s.id);
      const spendMap = await getBatchSiteSpend(siteIds);
      for (const site of activeSites) {
        const spent = spendMap.get(site.id) ?? 0n;
        const contract = site.contractValuePaise;
        if (contract <= 0n) continue;
        const pct = Number((spent * 10000n) / contract) / 100;
        if (pct >= 80) {
          budgetWarnings.push({
            siteId: site.id,
            siteName: site.name,
            pct,
            overrun: pct > 100,
          });
        }
      }
      budgetWarnings.sort((a, b) => b.pct - a.pct);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Onboarding checklist */}
      {showOnboarding && (
        <OnboardingChecklist
          hasSite={onboardingState.hasSite}
          hasEmployee={onboardingState.hasEmployee}
          hasTopUp={onboardingState.hasTopUp}
        />
      )}

      {/* Budget warning alerts */}
      {budgetWarnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-800 mb-2">
            Budget Alerts
          </p>
          {budgetWarnings.map((w) => (
            <Link
              key={w.siteId}
              href={`/sites/${w.siteId}`}
              className="flex items-center gap-2 text-sm hover:underline"
            >
              {w.overrun ? (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
              )}
              <span className={w.overrun ? "text-red-700 font-medium" : "text-yellow-800"}>
                {w.siteName} is at {w.pct.toFixed(1)}% of budget
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Sites
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.activeSiteCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cash With Team
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatINR(stats.cashWithTeam)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-green-600">
              In: {formatINR(stats.monthlyIn)}
            </p>
            <p className="text-sm font-semibold text-red-600">
              Out: {formatINR(stats.monthlyOut)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance card */}
      <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Attendance</p>
            {todayAttendanceSummary ? (
              <p className="text-xs text-muted-foreground">
                {todayAttendanceSummary.presentCount} / {todayAttendanceSummary.total} present today
              </p>
            ) : myTodayAttendance ? (
              <p className="text-xs text-green-600 font-medium">Checked in today</p>
            ) : (
              <p className="text-xs text-muted-foreground">Not checked in yet</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!myTodayAttendance && (
            <Button asChild size="sm">
              <Link href="/attendance/check-in">Check In</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/attendance">View</Link>
          </Button>
        </div>
      </div>

      {/* Sites section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Sites</h2>
          {user.role === "OWNER" && <CreateSiteDialog />}
        </div>
        {topSites.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-sm">No sites yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first site to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border divide-y">
            {topSites.map((site) => (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {site.clientName} · {site.location}
                  </p>
                </div>
                <Badge
                  variant={
                    site.status === "ACTIVE"
                      ? "default"
                      : site.status === "COMPLETED"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs shrink-0"
                >
                  {STATUS_LABELS[site.status] ?? site.status}
                </Badge>
              </Link>
            ))}
            {allSites.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link
                  href="/sites"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  View all {allSites.length} sites →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent site updates (owner) */}
      {user.role === "OWNER" && recentUpdates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Updates</h2>
            <Link href="/updates" className="text-xs text-muted-foreground underline underline-offset-2">
              View all →
            </Link>
          </div>
          <div className="rounded-lg border divide-y">
            {recentUpdates.map((u) => {
              const diff = Date.now() - u.createdAt.getTime();
              const mins = Math.floor(diff / 60000);
              const hours = Math.floor(mins / 60);
              const days = Math.floor(hours / 24);
              const rel = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : hours < 24 ? `${hours}h ago` : `${days}d ago`;
              return (
                <Link
                  key={u.id}
                  href={`/sites/${u.siteId}?tab=updates`}
                  className="flex items-start justify-between px-4 py-3 hover:bg-accent/50 transition-colors gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-primary">{u.siteName}</p>
                    <p className="text-sm truncate">{u.workDone}</p>
                    <p className="text-xs text-muted-foreground">{u.submitterName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{rel}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      {user.role === "OWNER" && (
        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/reports">Reports →</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/vendors">Vendors →</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/employees">Manage Employees →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
