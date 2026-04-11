"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserBadge } from "@/components/user-badge";
import type { AvailableItem } from "@/lib/material";
import Decimal from "decimal.js";

type SerializedTxn = {
  id: string;
  dateFormatted: string;
  type: string;
  typeLabel: string;
  typeClass: string;
  direction: "CREDIT" | "DEBIT";
  amountFormatted: string;
  siteName: string | null;
  note: string | null;
  actorName: string;
  loggedByName: string;
  isSelfLogged: boolean;
};

type SerializedPurchase = {
  id: string;
  purchaseDateFormatted: string;
  itemName: string;
  quantity: string;
  unit: string;
  totalFormatted: string;
  vendorName: string;
  paidByName: string | null;
  billPhotoUrl: string | null;
};

type SerializedTransferIn = {
  id: string;
  dateFormatted: string;
  itemName: string;
  quantity: string;
  unit: string;
  costFormatted: string;
  fromName: string;
};

type SerializedTransferOut = {
  id: string;
  dateFormatted: string;
  itemName: string;
  quantity: string;
  unit: string;
  costFormatted: string;
  toName: string;
};

export const TYPE_CLASSES: Record<string, string> = {
  TOPUP: "bg-green-100 text-green-700",
  EXPENSE: "bg-red-100 text-red-700",
  TRANSFER_OUT: "bg-orange-100 text-orange-700",
  TRANSFER_IN: "bg-blue-100 text-blue-700",
  VENDOR_PAYMENT: "bg-purple-100 text-purple-700",
  REVERSAL: "bg-gray-100 text-gray-600",
};

type Props = {
  transactions: SerializedTxn[];
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalCount: number;
  siteId: string;
  availableMaterial: AvailableItem[];
  purchaseCount: number;
  recentPurchases: SerializedPurchase[];
  transfersIn: SerializedTransferIn[];
  transfersOut: SerializedTransferOut[];
};

export function SiteTabs({
  transactions,
  currentPage,
  hasNext,
  hasPrev,
  totalCount,
  siteId,
  availableMaterial,
  purchaseCount,
  recentPurchases,
  transfersIn,
  transfersOut,
}: Props) {
  function pageUrl(p: number) {
    return p === 1 ? `/sites/${siteId}` : `/sites/${siteId}?page=${p}`;
  }

  return (
    <Tabs defaultValue="transactions">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="transactions">
          Transactions
          {totalCount > 0 && (
            <span className="ml-1.5 text-xs opacity-60">({totalCount})</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="material">
          Material
          {availableMaterial.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              ({availableMaterial.length})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="income">Income</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>

      {/* ── Transactions ── */}
      <TabsContent value="transactions" className="mt-4 space-y-3">
        {transactions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No transactions yet for this site
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="divide-y">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="px-4 py-3 flex items-start gap-3 text-sm"
                >
                  <div className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">
                    {txn.dateFormatted}
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        txn.typeClass
                      )}
                    >
                      {txn.typeLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{txn.actorName}</div>
                    {txn.note && (
                      <div className="text-xs text-muted-foreground truncate">
                        {txn.note}
                      </div>
                    )}
                    {!txn.isSelfLogged && (
                      <div className="mt-1">
                        <UserBadge name={`by ${txn.loggedByName}`} />
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      txn.direction === "CREDIT"
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {txn.direction === "CREDIT" ? "+" : "−"}
                    {txn.amountFormatted}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(hasPrev || hasNext) && (
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground text-xs">
              Page {currentPage} of {Math.ceil(totalCount / 20)}
            </div>
            <div className="flex gap-2">
              {hasPrev && (
                <Link
                  href={pageUrl(currentPage - 1)}
                  className="text-xs underline underline-offset-2"
                >
                  ← Previous
                </Link>
              )}
              {hasNext && (
                <Link
                  href={pageUrl(currentPage + 1)}
                  className="text-xs underline underline-offset-2"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Material ── */}
      <TabsContent value="material" className="mt-4 space-y-6">
        {/* Current stock */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Current Stock</h3>
          {availableMaterial.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No material currently at this site
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Item
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Qty
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Total Cost
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                      Avg/Unit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {availableMaterial.map((item) => (
                    <tr key={item.itemName}>
                      <td className="px-3 py-2 font-medium">{item.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {new Decimal(item.availableQty).toFixed(2)} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ₹{(Number(item.totalCostPaise) / 100).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        ₹{(Number(item.avgCostPerUnitPaise) / 100).toFixed(2)}/
                        {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purchase history for this site */}
        {recentPurchases.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              Purchases
              <span className="font-normal text-muted-foreground ml-1.5 text-xs">
                ({purchaseCount} total)
              </span>
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Item
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Qty
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Total
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                      Vendor
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                      Paid By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentPurchases.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.purchaseDateFormatted}
                      </td>
                      <td className="px-3 py-2 font-medium">{p.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {p.totalFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {p.vendorName}
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {p.paidByName ? (
                          p.paidByName
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Owner Direct
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transfer history */}
        {(transfersIn.length > 0 || transfersOut.length > 0) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Material Movements</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Direction
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Item
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Qty
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                      Cost
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                      From/To
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfersIn.map((t) => (
                    <tr key={`in-${t.id}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {t.dateFormatted}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          IN
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">{t.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.quantity} {t.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600">
                        +{t.costFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        from {t.fromName}
                      </td>
                    </tr>
                  ))}
                  {transfersOut.map((t) => (
                    <tr key={`out-${t.id}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {t.dateFormatted}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                          OUT
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">{t.itemName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {t.quantity} {t.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">
                        −{t.costFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        to {t.toName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Income ── */}
      <TabsContent value="income" className="mt-4">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Income tracking — coming in Phase 5
          </p>
        </div>
      </TabsContent>

      {/* ── Team ── */}
      <TabsContent value="team" className="mt-4">
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Team assignments — coming soon
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
