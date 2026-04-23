import Link from "next/link";
import { getUnscopedDb } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserBadge } from "@/components/user-badge";
import { VoidWalletTxnButton } from "@/components/wallet/void-wallet-txn-button";
import { PayrollActionButtonsClient } from "./payroll-action-buttons-client";
import type { WalletTxnType } from "@prisma/client";

const db = getUnscopedDb();
const ITEMS_PER_PAGE = 20;

const TYPE_LABELS: Record<string, string> = {
  SALARY: "Salary",
  ADVANCE_RECOVERY: "Recovery",
};

const TYPE_CLASSES: Record<string, string> = {
  SALARY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ADVANCE_RECOVERY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

type Props = {
  userId: string;
  employeeName: string;
  companyId: string;
  basePath: string;
  isOwnerOrManager: boolean;
  page?: number;
  from?: string;
  to?: string;
};

function formatPaymentDate(txn: { paymentDate: Date | null; createdAt: Date }): string {
  const d = txn.paymentDate ?? txn.createdAt;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function buildPageUrl(basePath: string, page: number, from?: string, to?: string): string {
  const p = new URLSearchParams({ tab: "payroll" });
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (page > 1) p.set("page", String(page));
  return `${basePath}?${p.toString()}`;
}

export async function PayrollTabSection({
  userId,
  employeeName,
  companyId,
  basePath,
  isOwnerOrManager,
  page = 1,
  from,
  to,
}: Props) {
  // Ledger shows only payroll transactions (not wallet top-ups)
  const ledgerTypes: WalletTxnType[] = ["SALARY", "ADVANCE_RECOVERY"];

  const baseWhere = {
    actorUserId: userId,
    companyId,
    type: { in: ledgerTypes },
  };

  const dateCondition =
    from || to
      ? {
          OR: [
            {
              paymentDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
              },
            },
            {
              paymentDate: null,
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
              },
            },
          ],
        }
      : {};

  const [txns, total, summaryRows, advanceSummary, notes] = await Promise.all([
    db.walletTransaction.findMany({
      where: { ...baseWhere, ...dateCondition },
      include: { loggedBy: { select: { name: true } } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    db.walletTransaction.count({ where: { ...baseWhere, ...dateCondition } }),
    db.walletTransaction.groupBy({
      by: ["type"],
      where: { ...baseWhere, voidedAt: null },
      _sum: { amountPaise: true },
    }),
    // Advances (TOPUP) queried separately — wallet operations, not in ledger
    db.walletTransaction.groupBy({
      by: ["type"],
      where: {
        actorUserId: userId,
        companyId,
        type: { in: ["TOPUP", "ADVANCE_RECOVERY"] as WalletTxnType[] },
        voidedAt: null,
      },
      _sum: { amountPaise: true },
    }),
    db.payrollNote.findMany({
      where: { userId, companyId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { noteDate: "desc" },
    }),
  ]);

  const sumMap = Object.fromEntries(
    summaryRows.map((s) => [s.type, s._sum.amountPaise ?? 0n])
  ) as Record<string, bigint>;

  const advMap = Object.fromEntries(
    advanceSummary.map((s) => [s.type, s._sum.amountPaise ?? 0n])
  ) as Record<string, bigint>;

  const totalSalary = sumMap["SALARY"] ?? 0n;
  const totalRecovery = sumMap["ADVANCE_RECOVERY"] ?? 0n;
  const totalAdvances = advMap["TOPUP"] ?? 0n;
  const totalAdvRecovery = advMap["ADVANCE_RECOVERY"] ?? 0n;
  // Outstanding advance = advances given - recoveries deducted from salary
  const outstandingAdvance = totalAdvances > totalAdvRecovery ? totalAdvances - totalAdvRecovery : 0n;

  const hasNext = page * ITEMS_PER_PAGE < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Salary Paid", value: totalSalary, color: "text-green-600" },
          { label: "Advance Given", value: totalAdvances, color: "text-amber-600" },
          { label: "Recovered", value: totalRecovery, color: "text-blue-600" },
          {
            label: "Outstanding Advance",
            value: outstandingAdvance,
            color: outstandingAdvance > 0n ? "text-orange-600" : "text-muted-foreground",
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className={cn("font-bold tabular-nums text-sm", color)}>
                {formatINR(value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action buttons (owner/manager only) */}
      {isOwnerOrManager && (
        <PayrollActionButtonsClient
          userId={userId}
          employeeName={employeeName}
          outstandingAdvancePaise={outstandingAdvance.toString()}
        />
      )}

      {/* Date filter */}
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="payroll" />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted"
        >
          Filter
        </button>
        {(from || to) && (
          <Link
            href={`${basePath}?tab=payroll`}
            className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground flex items-center"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Payroll ledger — salary and recoveries only */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Payroll Ledger
            {total > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">({total})</span>
            )}
          </h3>
          {total > 0 && (
            <Link
              href={`/api/payroll/export?userId=${userId}`}
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
            >
              Download CSV
            </Link>
          )}
        </div>

        {txns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No payroll transactions found</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="divide-y">
              {txns.map((txn) => {
                const isVoided = txn.voidedAt !== null;
                return (
                  <div
                    key={txn.id}
                    className={cn(
                      "px-4 py-3 flex items-start gap-3 text-sm",
                      isVoided && "opacity-50"
                    )}
                  >
                    <div className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5">
                      {formatPaymentDate(txn)}
                    </div>

                    <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          isVoided
                            ? "bg-gray-100 text-gray-400 line-through"
                            : (TYPE_CLASSES[txn.type] ?? "bg-gray-100 text-gray-600")
                        )}
                      >
                        {TYPE_LABELS[txn.type] ?? txn.type}
                      </span>
                      {isVoided && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-gray-300 text-gray-400">
                          VOIDED
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {txn.note && (
                        <span
                          className={cn(
                            "text-xs text-muted-foreground block truncate max-w-[200px]",
                            isVoided && "line-through"
                          )}
                        >
                          {txn.note}
                        </span>
                      )}
                      {txn.loggedById !== txn.actorUserId && (
                        <div className="mt-0.5">
                          <UserBadge name={`by ${txn.loggedBy.name}`} />
                        </div>
                      )}
                    </div>

                    <div
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        isVoided
                          ? "text-muted-foreground line-through"
                          : txn.direction === "CREDIT"
                            ? "text-green-600"
                            : "text-red-600"
                      )}
                    >
                      {txn.direction === "CREDIT" ? "+" : "−"}
                      {formatINR(txn.amountPaise)}
                    </div>

                    {isOwnerOrManager && !isVoided && (
                      <VoidWalletTxnButton txnId={txn.id} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">
              Page {page} of {Math.ceil(total / ITEMS_PER_PAGE)}
            </span>
            <div className="flex gap-2">
              {hasPrev && (
                <Link
                  href={buildPageUrl(basePath, page - 1, from, to)}
                  className="text-xs underline underline-offset-2"
                >
                  ← Previous
                </Link>
              )}
              {hasNext && (
                <Link
                  href={buildPageUrl(basePath, page + 1, from, to)}
                  className="text-xs underline underline-offset-2"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Notes</h3>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p>{n.note}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(n.noteDate)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  — {n.createdBy.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
