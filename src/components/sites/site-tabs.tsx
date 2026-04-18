"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserBadge } from "@/components/user-badge";
import { VoidButton } from "@/components/void-button";
import { AddIncomeDialog } from "@/components/incomes/add-income-dialog";
import { voidWalletTransaction } from "@/app/actions/wallet";
import { voidMaterialTransfer } from "@/app/actions/material-transfers";
import { voidSiteIncome } from "@/app/actions/incomes";
import { voidPurchase } from "@/app/actions/purchases";
import type { AvailableItem } from "@/lib/material";
import type { AvailableMaterialItem } from "@/lib/site-materials";
import { TeamTab } from "./team-tab";
import { UpdatesTab } from "./updates-tab";
import type { SerializedUpdate } from "./update-card";
import { voidConsumption } from "@/app/actions/material-consumption";
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
  isVoided: boolean;
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
  isVoided: boolean;
};

type SerializedTransferIn = {
  id: string;
  dateFormatted: string;
  itemName: string;
  quantity: string;
  unit: string;
  costFormatted: string;
  fromName: string;
  isVoided: boolean;
};

type SerializedTransferOut = {
  id: string;
  dateFormatted: string;
  itemName: string;
  quantity: string;
  unit: string;
  costFormatted: string;
  toName: string;
  isVoided: boolean;
};

type SerializedIncome = {
  id: string;
  dateFormatted: string;
  type: string;
  typeLabel: string;
  amountFormatted: string;
  note: string | null;
  loggedByName: string;
  isVoided: boolean;
};

export const TYPE_CLASSES: Record<string, string> = {
  TOPUP: "bg-green-100 text-green-700",
  EXPENSE: "bg-red-100 text-red-700",
  TRANSFER_OUT: "bg-orange-100 text-orange-700",
  TRANSFER_IN: "bg-blue-100 text-blue-700",
  VENDOR_PAYMENT: "bg-purple-100 text-purple-700",
  REVERSAL: "bg-gray-100 text-gray-600",
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  ADVANCE: "Advance",
  RUNNING_BILL: "Running Bill",
  FINAL: "Final",
  RETENTION: "Retention",
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  title: string | null;
};

type SerializedConsumption = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  dateFormatted: string;
  note: string | null;
  loggedByName: string;
  isVoided: boolean;
};

type Props = {
  transactions: SerializedTxn[];
  currentPage: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalCount: number;
  siteId: string;
  siteName: string;
  availableMaterial: AvailableItem[];
  availableMaterialV2: AvailableMaterialItem[];
  consumptionHistory: SerializedConsumption[];
  purchaseCount: number;
  recentPurchases: SerializedPurchase[];
  transfersIn: SerializedTransferIn[];
  transfersOut: SerializedTransferOut[];
  incomes: SerializedIncome[];
  incomeTotalFormatted: string;
  isOwner: boolean;
  canManageTeam: boolean;
  assignedTeam: TeamMember[];
  teamCandidates: TeamMember[];
  // Updates tab
  siteUpdates: SerializedUpdate[];
  updatesTotal: number;
  canPostUpdate: boolean;
  currentUserId: string;
};

export function SiteTabs({
  transactions,
  currentPage,
  hasNext,
  hasPrev,
  totalCount,
  siteId,
  siteName,
  availableMaterial,
  availableMaterialV2,
  consumptionHistory,
  purchaseCount,
  recentPurchases,
  transfersIn,
  transfersOut,
  incomes,
  incomeTotalFormatted,
  isOwner,
  canManageTeam,
  assignedTeam,
  teamCandidates,
  siteUpdates,
  updatesTotal,
  canPostUpdate,
  currentUserId,
}: Props) {
  function pageUrl(p: number) {
    return p === 1 ? `/sites/${siteId}` : `/sites/${siteId}?page=${p}`;
  }

  const activeIncomes = incomes.filter((i) => !i.isVoided);
  const siteForDialog = [{ id: siteId, name: siteName }];

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
        <TabsTrigger value="income">
          Income
          {activeIncomes.length > 0 && (
            <span className="ml-1.5 text-xs opacity-60">
              ({activeIncomes.length})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="updates">
          Updates
          {updatesTotal > 0 && (
            <span className="ml-1.5 text-xs opacity-60">({updatesTotal})</span>
          )}
        </TabsTrigger>
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
                  className={cn(
                    "px-4 py-3 flex items-start gap-3 text-sm",
                    txn.isVoided && "opacity-50"
                  )}
                >
                  <div className="w-28 shrink-0 text-xs text-muted-foreground pt-0.5">
                    {txn.dateFormatted}
                  </div>
                  <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        txn.isVoided
                          ? "bg-gray-100 text-gray-400 line-through"
                          : txn.typeClass
                      )}
                    >
                      {txn.typeLabel}
                    </span>
                    {txn.isVoided && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-gray-300 text-gray-400">
                        VOIDED
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{txn.actorName}</div>
                    {txn.note && (
                      <div className={cn("text-xs text-muted-foreground truncate", txn.isVoided && "line-through")}>
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
                      txn.isVoided
                        ? "text-muted-foreground line-through"
                        : txn.direction === "CREDIT"
                          ? "text-green-600"
                          : "text-red-600"
                    )}
                  >
                    {txn.direction === "CREDIT" ? "+" : "−"}
                    {txn.amountFormatted}
                  </div>
                  {isOwner && !txn.isVoided && (
                    <VoidButton
                      action={voidWalletTransaction.bind(null, txn.id)}
                      label="Void Transaction"
                    />
                  )}
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
        {/* Available stock (v2 — includes consumption) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Available at This Site</h3>
            <Link
              href={`/sites/${siteId}/consume`}
              className="text-xs text-primary underline underline-offset-2"
            >
              + Log Consumption
            </Link>
          </div>
          {availableMaterialV2.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">No material at this site</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Purchased</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Xfer In</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Xfer Out</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumed</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {availableMaterialV2.map((item) => (
                    <tr key={item.itemName} className={item.isNegative ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 font-medium">
                        {item.itemName}
                        <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {new Decimal(item.totalPurchased).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {new Decimal(item.totalTransferredIn).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {new Decimal(item.totalTransferredOut).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {new Decimal(item.totalConsumed).toFixed(2)}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", item.isNegative ? "text-red-600" : "")}>
                        {new Decimal(item.available).toFixed(2)}
                        {item.isNegative && <span className="ml-1">⚠</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Consumption history */}
        {consumptionHistory.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Consumption History</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Note</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">By</th>
                    {canManageTeam && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {consumptionHistory.map((c) => (
                    <tr key={c.id} className={c.isVoided ? "opacity-50" : ""}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.dateFormatted}</td>
                      <td className={cn("px-3 py-2 font-medium", c.isVoided && "line-through")}>
                        {c.itemName}
                        {c.isVoided && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">
                            VOIDED
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.quantity} {c.unit}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell">{c.note ?? "—"}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <UserBadge name={c.loggedByName} />
                      </td>
                      {canManageTeam && (
                        <td className="px-1 py-2">
                          {!c.isVoided && (
                            <VoidButton
                              action={voidConsumption.bind(null, c.id)}
                              label="Void Consumption"
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legacy stock from material.ts (for transfer context) */}
        {availableMaterial.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Legacy stock view (excludes consumption)
            </summary>
            <div className="mt-2 rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Cost</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Avg/Unit</th>
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
                        ₹{(Number(item.avgCostPerUnitPaise) / 100).toFixed(2)}/{item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Purchase history */}
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Vendor</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Paid By</th>
                    {isOwner && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentPurchases.map((p) => (
                    <tr key={p.id} className={p.isVoided ? "opacity-50" : ""}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.purchaseDateFormatted}
                      </td>
                      <td className={cn("px-3 py-2 font-medium", p.isVoided && "line-through")}>
                        {p.itemName}
                        {p.isVoided && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">
                            VOIDED
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.quantity} {p.unit}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium", p.isVoided && "line-through")}>
                        {p.totalFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{p.vendorName}</td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {p.paidByName ?? (
                          <Badge variant="outline" className="text-xs">Owner Direct</Badge>
                        )}
                      </td>
                      {isOwner && (
                        <td className="px-1 py-2">
                          {!p.isVoided && (
                            <VoidButton
                              action={voidPurchase.bind(null, p.id)}
                              label="Void Purchase"
                            />
                          )}
                        </td>
                      )}
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Dir</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">From/To</th>
                    {isOwner && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfersIn.map((t) => (
                    <tr key={`in-${t.id}`} className={t.isVoided ? "opacity-50" : ""}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.dateFormatted}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">IN</Badge>
                      </td>
                      <td className={cn("px-3 py-2 font-medium", t.isVoided && "line-through")}>
                        {t.itemName}
                        {t.isVoided && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">VOIDED</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.quantity} {t.unit}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", t.isVoided ? "text-muted-foreground line-through" : "text-green-600")}>
                        +{t.costFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">from {t.fromName}</td>
                      {isOwner && (
                        <td className="px-1 py-2">
                          {!t.isVoided && (
                            <VoidButton
                              action={voidMaterialTransfer.bind(null, t.id)}
                              label="Void Transfer"
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {transfersOut.map((t) => (
                    <tr key={`out-${t.id}`} className={t.isVoided ? "opacity-50" : ""}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.dateFormatted}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">OUT</Badge>
                      </td>
                      <td className={cn("px-3 py-2 font-medium", t.isVoided && "line-through")}>
                        {t.itemName}
                        {t.isVoided && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">VOIDED</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.quantity} {t.unit}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", t.isVoided ? "text-muted-foreground line-through" : "text-red-600")}>
                        −{t.costFormatted}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">to {t.toName}</td>
                      {isOwner && (
                        <td className="px-1 py-2">
                          {!t.isVoided && (
                            <VoidButton
                              action={voidMaterialTransfer.bind(null, t.id)}
                              label="Void Transfer"
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Income ── */}
      <TabsContent value="income" className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Client Payments Received
            {activeIncomes.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">
                — Total: {incomeTotalFormatted}
              </span>
            )}
          </h3>
          {isOwner && (
            <AddIncomeDialog
              sites={siteForDialog}
              defaultSiteId={siteId}
            />
          )}
        </div>

        {incomes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No income recorded yet
            </p>
            {isOwner && (
              <p className="text-xs text-muted-foreground mt-1">
                Use the &ldquo;Add Income&rdquo; button to record a client payment.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Note</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Logged By</th>
                  {isOwner && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {incomes.map((inc) => (
                  <tr key={inc.id} className={inc.isVoided ? "opacity-50" : ""}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{inc.dateFormatted}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                        {INCOME_TYPE_LABELS[inc.type] ?? inc.type}
                      </span>
                      {inc.isVoided && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">
                          VOIDED
                        </Badge>
                      )}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-medium",
                      inc.isVoided ? "text-muted-foreground line-through" : "text-green-600"
                    )}>
                      +{inc.amountFormatted}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell truncate max-w-[180px]">
                      {inc.note ?? "—"}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <UserBadge name={inc.loggedByName} />
                    </td>
                    {isOwner && (
                      <td className="px-1 py-2">
                        {!inc.isVoided && (
                          <VoidButton
                            action={voidSiteIncome.bind(null, inc.id)}
                            label="Void Income"
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {activeIncomes.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                      Total Received
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-600">
                      {incomeTotalFormatted}
                    </td>
                    <td colSpan={isOwner ? 3 : 2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </TabsContent>

      {/* ── Updates ── */}
      <TabsContent value="updates" className="mt-4">
        <UpdatesTab
          siteId={siteId}
          initialUpdates={siteUpdates}
          totalCount={updatesTotal}
          canPost={canPostUpdate}
          currentUserId={currentUserId}
          canVoid={canManageTeam}
        />
      </TabsContent>

      {/* ── Team ── */}
      <TabsContent value="team" className="mt-4">
        <TeamTab
          siteId={siteId}
          assigned={assignedTeam}
          candidates={teamCandidates}
          canManage={canManageTeam}
        />
      </TabsContent>
    </Tabs>
  );
}
