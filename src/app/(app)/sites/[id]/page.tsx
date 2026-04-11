import { notFound, redirect } from "next/navigation";
import { MapPin, User, CalendarDays, BadgeIndianRupee, Plus } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR, toRupees } from "@/lib/money";
import { getSiteSpend } from "@/lib/site-financials";
import { getAvailableMaterial } from "@/lib/material";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditSiteButton } from "@/components/sites/edit-site-dialog";
import { SiteTabs, TYPE_CLASSES } from "@/components/sites/site-tabs";
import type { Metadata } from "next";
import type { ExpenseCategory } from "@prisma/client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, select: { name: true } });
  return { title: site ? `${site.name} — ConstructHub` : "Site" };
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  ON_HOLD: "outline",
};
const TYPE_LABELS: Record<string, string> = {
  TOPUP: "Top Up",
  EXPENSE: "Expense",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  VENDOR_PAYMENT: "Vendor Payment",
  REVERSAL: "Reversal",
};
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MATERIALS: "Materials",
  LABOR: "Labor",
  TRANSPORT: "Transport",
  FOOD: "Food",
  MISC: "Misc",
  OTHER: "Other",
};
const CATEGORY_ORDER: ExpenseCategory[] = [
  "MATERIALS", "LABOR", "TRANSPORT", "FOOD", "MISC", "OTHER",
];

const ITEMS_PER_PAGE = 20;

export default async function SiteDetailPage({ params, searchParams }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const site = await db.site.findUnique({ where: { id } });
  if (!site) notFound();

  // Fetch all data in parallel
  const [
    totalSpent,
    categoryBreakdown,
    txnCount,
    transactions,
    availableMaterial,
    purchaseCount,
    recentPurchases,
    transfersIn,
    transfersOut,
  ] = await Promise.all([
    // getSiteSpend: accounts for wallet txns + owner-direct purchases + material transfers
    getSiteSpend(id),

    // Category breakdown from wallet transactions only (purchases lack categories)
    db.walletTransaction.groupBy({
      by: ["category"],
      _sum: { amountPaise: true },
      where: {
        siteId: id,
        direction: "DEBIT",
        type: { in: ["EXPENSE", "VENDOR_PAYMENT"] },
        voidedAt: null,
        category: { not: null },
      },
    }),

    db.walletTransaction.count({ where: { siteId: id, voidedAt: null } }),

    db.walletTransaction.findMany({
      where: { siteId: id, voidedAt: null },
      include: {
        actor: { select: { name: true } },
        loggedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),

    // Material currently at this site
    getAvailableMaterial(id),

    db.purchase.count({ where: { destinationSiteId: id, voidedAt: null } }),

    db.purchase.findMany({
      where: { destinationSiteId: id, voidedAt: null },
      include: {
        vendor: { select: { name: true } },
        paidBy: { select: { name: true } },
      },
      orderBy: { purchaseDate: "desc" },
      take: 10,
    }),

    db.materialTransfer.findMany({
      where: { toSiteId: id, voidedAt: null },
      include: { fromSite: { select: { name: true } } },
      orderBy: { transferDate: "desc" },
      take: 10,
    }),

    db.materialTransfer.findMany({
      where: { fromSiteId: id, voidedAt: null },
      include: { toSite: { select: { name: true } } },
      orderBy: { transferDate: "desc" },
      take: 10,
    }),
  ]);

  const budget = site.contractValuePaise;
  const budgetPct = budget > 0n
    ? Number((totalSpent * 10000n) / budget) / 100
    : 0;
  const budgetPctCapped = Math.min(budgetPct, 100);
  const budgetOverrun = budgetPct > 100;

  // Category breakdown map (wallet txns only — purchases don't have categories)
  const catMap: Partial<Record<ExpenseCategory, bigint>> = {};
  for (const row of categoryBreakdown) {
    if (row.category && row._sum.amountPaise) {
      catMap[row.category as ExpenseCategory] = row._sum.amountPaise;
    }
  }

  // Wallet-txn spend (for category breakdown denominator — wallet only)
  const walletSpentForCats = Object.values(catMap).reduce((a, b) => a + (b ?? 0n), 0n);

  const serializedTxns = transactions.map((txn) => ({
    id: txn.id,
    dateFormatted: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(txn.createdAt),
    type: txn.type,
    typeLabel: TYPE_LABELS[txn.type] ?? txn.type,
    typeClass: TYPE_CLASSES[txn.type] ?? "bg-gray-100 text-gray-600",
    direction: txn.direction,
    amountFormatted: formatINR(txn.amountPaise),
    siteName: null,
    note: txn.note,
    actorName: txn.actor.name,
    loggedByName: txn.loggedBy.name,
    isSelfLogged: txn.loggedById === txn.actorUserId,
  }));

  const serializedSite = {
    id: site.id,
    name: site.name,
    location: site.location,
    clientName: site.clientName,
    contractValueRupees: toRupees(site.contractValuePaise),
    startDate: site.startDate.toISOString().split("T")[0],
    expectedEndDate: site.expectedEndDate
      ? site.expectedEndDate.toISOString().split("T")[0]
      : "",
    status: site.status,
  };

  const hasNext = page * ITEMS_PER_PAGE < txnCount;
  const hasPrev = page > 1;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{site.name}</h1>
            <Badge variant={STATUS_VARIANT[site.status] ?? "secondary"}>
              {STATUS_LABELS[site.status] ?? site.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {site.location}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {site.clientName}
            </span>
            <span className="flex items-center gap-1">
              <BadgeIndianRupee className="h-3.5 w-3.5" />
              {formatINR(site.contractValuePaise)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Started{" "}
              {site.startDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            {site.expectedEndDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Expected{" "}
                {site.expectedEndDate.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === "OWNER" && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`/material-transfers/new?from=${id}`}>
                  Transfer Material
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/expense/new?site=${site.id}`}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Expense
                </Link>
              </Button>
              <EditSiteButton site={serializedSite} />
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums text-muted-foreground">₹0.00</p>
            <p className="text-xs text-muted-foreground mt-0.5">Phase 5</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums">
              {formatINR(totalSpent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums text-muted-foreground">
              −{formatINR(totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Income P5</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Budget Used
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className={`text-lg font-bold ${budgetOverrun ? "text-red-600" : ""}`}>
              {budgetPct.toFixed(1)}%
              {budgetOverrun && <span className="text-xs ml-1">⚠</span>}
            </p>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${budgetOverrun ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${budgetPctCapped}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Cost Breakdown
          <span className="font-normal text-muted-foreground ml-1.5 text-xs">
            (wallet expenses only)
          </span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_ORDER.map((cat) => {
            const catAmount = catMap[cat] ?? 0n;
            const pct =
              walletSpentForCats > 0n
                ? Number((catAmount * 10000n) / walletSpentForCats) / 100
                : 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="tabular-nums">{formatINR(catAmount)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className="bg-primary h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <SiteTabs
        transactions={serializedTxns}
        currentPage={page}
        hasNext={hasNext}
        hasPrev={hasPrev}
        totalCount={txnCount}
        siteId={id}
        availableMaterial={availableMaterial}
        purchaseCount={purchaseCount}
        recentPurchases={recentPurchases.map((p) => ({
          id: p.id,
          purchaseDateFormatted: p.purchaseDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          itemName: p.itemName,
          quantity: Number(p.quantity).toFixed(2),
          unit: p.unit,
          totalFormatted: formatINR(p.totalPaise),
          vendorName: p.vendor.name,
          paidByName: p.paidBy?.name ?? null,
          billPhotoUrl: p.billPhotoUrl,
        }))}
        transfersIn={transfersIn.map((t) => ({
          id: t.id,
          dateFormatted: t.transferDate.toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          }),
          itemName: t.itemName,
          quantity: Number(t.quantity).toFixed(2),
          unit: t.unit,
          costFormatted: formatINR(t.costMovedPaise),
          fromName: t.fromSite?.name ?? "Central Store",
        }))}
        transfersOut={transfersOut.map((t) => ({
          id: t.id,
          dateFormatted: t.transferDate.toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          }),
          itemName: t.itemName,
          quantity: Number(t.quantity).toFixed(2),
          unit: t.unit,
          costFormatted: formatINR(t.costMovedPaise),
          toName: t.toSite.name,
        }))}
      />
    </div>
  );
}
