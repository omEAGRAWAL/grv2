import Link from "next/link";
import type { WalletTxnType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { UserBadge } from "@/components/user-badge";
import { WalletFilters } from "./wallet-filters";

const ITEMS_PER_PAGE = 20;

type Props = {
  userId: string;
  basePath: string;
  page?: number;
  type?: string;
  from?: string;
  to?: string;
};

const TYPE_LABELS: Record<string, string> = {
  TOPUP: "Top Up",
  EXPENSE: "Expense",
  TRANSFER_OUT: "Transfer Out",
  TRANSFER_IN: "Transfer In",
  VENDOR_PAYMENT: "Vendor Payment",
  REVERSAL: "Reversal",
};

const TYPE_CLASSES: Record<string, string> = {
  TOPUP: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EXPENSE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  TRANSFER_OUT: "bg-orange-100 text-orange-700",
  TRANSFER_IN: "bg-blue-100 text-blue-700",
  VENDOR_PAYMENT: "bg-purple-100 text-purple-700",
  REVERSAL: "bg-gray-100 text-gray-600",
};

function formatTxnDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function buildPaginationUrl(
  basePath: string,
  page: number,
  type?: string,
  from?: string,
  to?: string
): string {
  const params = new URLSearchParams();
  if (type && type !== "ALL") params.set("type", type);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export async function WalletHistorySection({
  userId,
  basePath,
  page = 1,
  type,
  from,
  to,
}: Props) {
  // Build the where clause safely
  const whereClause: {
    actorUserId: string;
    voidedAt: null;
    type?: WalletTxnType;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    actorUserId: userId,
    voidedAt: null,
  };
  if (type && type !== "ALL") whereClause.type = type as WalletTxnType;
  if (from || to) {
    whereClause.createdAt = {};
    if (from) whereClause.createdAt.gte = new Date(from);
    if (to) whereClause.createdAt.lte = new Date(to + "T23:59:59.999Z");
  }

  const [txns, total] = await Promise.all([
    db.walletTransaction.findMany({
      where: whereClause,
      include: {
        site: { select: { name: true } },
        loggedBy: { select: { name: true } },
        counterparty: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    db.walletTransaction.count({ where: whereClause }),
  ]);

  const hasNext = page * ITEMS_PER_PAGE < total;
  const hasPrev = page > 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="font-semibold text-sm">
          Wallet History
          {total > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({total})
            </span>
          )}
        </h2>
        <WalletFilters
          basePath={basePath}
          currentType={type}
          currentFrom={from}
          currentTo={to}
        />
      </div>

      {txns.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="divide-y">
            {txns.map((txn) => (
              <div
                key={txn.id}
                className="px-4 py-3 flex items-start gap-3 text-sm"
              >
                {/* Date */}
                <div className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">
                  {formatTxnDate(txn.createdAt)}
                </div>

                {/* Type badge */}
                <div className="shrink-0 pt-0.5">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                      TYPE_CLASSES[txn.type] ?? "bg-gray-100 text-gray-600"
                    )}
                  >
                    {TYPE_LABELS[txn.type] ?? txn.type}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    {txn.site && (
                      <span className="text-muted-foreground text-xs">
                        {txn.site.name}
                      </span>
                    )}
                    {txn.counterparty && (
                      <span className="text-muted-foreground text-xs">
                        · {txn.counterparty.name}
                      </span>
                    )}
                    {txn.note && (
                      <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {txn.site || txn.counterparty ? "· " : ""}
                        {txn.note}
                      </span>
                    )}
                  </div>
                  {txn.loggedById !== txn.actorUserId && (
                    <div className="mt-1">
                      <UserBadge name={`by ${txn.loggedBy.name}`} />
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div
                  className={cn(
                    "shrink-0 font-medium tabular-nums",
                    txn.direction === "CREDIT"
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {txn.direction === "CREDIT" ? "+" : "−"}
                  {formatINR(txn.amountPaise)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground text-xs">
            Page {page} of {Math.ceil(total / ITEMS_PER_PAGE)}
          </div>
          <div className="flex gap-2">
            {hasPrev && (
              <Link
                href={buildPaginationUrl(basePath, page - 1, type, from, to)}
                className="text-xs underline underline-offset-2"
              >
                ← Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildPaginationUrl(basePath, page + 1, type, from, to)}
                className="text-xs underline underline-offset-2"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
