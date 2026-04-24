import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecordPaymentDialog } from "@/components/purchases/record-payment-dialog";
import { VoidPurchaseButton } from "@/components/purchases/void-purchase-button";
import { VoidPaymentButton } from "@/components/purchases/void-payment-button";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = await (db as any).purchase.findUnique({
    where: { id },
    select: {
      itemName: true,
      purchaseType: true,
      sellerName: true,
      vendor: { select: { name: true } },
      lineItems: { take: 1, orderBy: { displayOrder: "asc" }, select: { itemName: true } },
    },
  });
  if (!p) return { title: "Purchase" };
  const itemLabel = p.lineItems?.[0]?.itemName ?? p.itemName ?? "Purchase";
  const sourceName = p.vendor?.name ?? p.sellerName ?? "LOCAL";
  return { title: `${itemLabel} — ${sourceName} — ConstructHub` };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
  if (status === "PARTIAL")
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">Unpaid</Badge>;
}

type LineItem = {
  id: string;
  itemName: string;
  quantity: { toString: () => string };
  unit: string;
  ratePaise: bigint;
  discountPercent: { toString: () => string };
  gstPercent: { toString: () => string };
  lineTotalPaise: bigint;
  displayOrder: number;
};

type PurchaseFull = {
  id: string;
  companyId: string;
  purchaseType: string;
  vendorId: string | null;
  sellerName: string | null;
  itemName: string | null;
  quantity: { toString: () => string } | null;
  unit: string | null;
  ratePaise: bigint | null;
  discountPercent: { toString: () => string } | null;
  gstPercent: { toString: () => string } | null;
  totalPaise: bigint;
  destinationSiteId: string | null;
  paymentStatus: string;
  purchaseDate: Date;
  billPhotoUrl: string | null;
  note: string | null;
  voidedAt: Date | null;
  vendor: { id: string; name: string } | null;
  destinationSite: { id: string; name: string } | null;
  loggedBy: { name: string };
  voidedBy: { name: string } | null;
  lineItems: LineItem[];
  payments: {
    id: string;
    paidDate: Date;
    amountPaidPaise: bigint;
    paymentMethod: string;
    paymentProofUrl: string | null;
    voidedAt: Date | null;
    paidBy: { name: string } | null;
    loggedBy: { name: string };
  }[];
};

export default async function PurchaseDetailPage({ params }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const purchase: PurchaseFull | null = await (db as any).purchase.findFirst({
    where: { id, companyId },
    include: {
      vendor: { select: { id: true, name: true } },
      destinationSite: { select: { id: true, name: true } },
      loggedBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
      lineItems: { orderBy: { displayOrder: "asc" } },
      payments: {
        orderBy: { paidDate: "asc" },
        include: {
          paidBy: { select: { name: true } },
          loggedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!purchase) notFound();

  const activePayments = purchase.payments.filter((p) => !p.voidedAt);
  const totalPaid = activePayments.reduce((s, p) => s + p.amountPaidPaise, 0n);
  const amountDue = purchase.totalPaise - totalPaid;

  const users = purchase.voidedAt
    ? []
    : await db.user.findMany({
        where: { companyId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

  const canRecord =
    !purchase.voidedAt &&
    purchase.paymentStatus !== "PAID" &&
    (currentUser.role === "OWNER" || currentUser.role === "SITE_MANAGER");

  // Determine display title and source
  const hasLineItems = purchase.lineItems.length > 0;
  const pageTitle = hasLineItems
    ? purchase.lineItems.length > 1
      ? `${purchase.lineItems[0].itemName} +${purchase.lineItems.length - 1} more`
      : purchase.lineItems[0].itemName
    : (purchase.itemName ?? "(items)");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            <Link href="/purchases" className="hover:underline">
              Purchases
            </Link>
            {purchase.vendor && (
              <>
                {" / "}
                <Link href={`/vendors/${purchase.vendor.id}`} className="hover:underline">
                  {purchase.vendor.name}
                </Link>
              </>
            )}
            {purchase.purchaseType === "LOCAL" && (
              <>
                {" / "}
                <span className="text-blue-600">Local Purchase</span>
              </>
            )}
          </p>
          <h1 className="text-xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {purchase.purchaseDate.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {purchase.destinationSite && (
              <>
                {" · "}
                <Link
                  href={`/sites/${purchase.destinationSite.id}`}
                  className="hover:underline"
                >
                  {purchase.destinationSite.name}
                </Link>
              </>
            )}
            {purchase.sellerName && (
              <span className="ml-1 text-muted-foreground">· {purchase.sellerName}</span>
            )}
          </p>
          {purchase.voidedAt && (
            <Badge variant="destructive" className="mt-1">
              Voided
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PaymentBadge status={purchase.paymentStatus} />
          {canRecord && (
            <RecordPaymentDialog
              purchaseId={purchase.id}
              remainingPaise={amountDue}
              users={users}
            />
          )}
          {!purchase.voidedAt && currentUser.role === "OWNER" && (
            <VoidPurchaseButton purchaseId={purchase.id} />
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums">{formatINR(purchase.totalPaise)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums text-green-700">
              {formatINR(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-lg font-bold tabular-nums ${
                amountDue > 0n ? "text-red-600" : "text-muted-foreground"
              }`}
            >
              {amountDue > 0n ? formatINR(amountDue) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold tabular-nums">
              {hasLineItems ? purchase.lineItems.length : 1}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Line items table (Phase 14) or legacy single-item details */}
      {hasLineItems ? (
        <div className="rounded-lg border overflow-x-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 pt-3 pb-1">
            Items
          </p>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                  Rate
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                  Disc %
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                  GST %
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchase.lineItems.map((li) => (
                <tr key={li.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{li.itemName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(li.quantity.toString()).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{li.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                    {formatINR(li.ratePaise)}
                  </td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">
                    {Number(li.discountPercent.toString()) > 0
                      ? `${Number(li.discountPercent.toString()).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right hidden sm:table-cell">
                    {Number(li.gstPercent.toString()) > 0
                      ? `${Number(li.gstPercent.toString()).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {formatINR(li.lineTotalPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 border-t">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-right font-semibold text-sm hidden sm:table-cell">
                  Grand Total
                </td>
                <td colSpan={3} className="px-3 py-2 text-right font-semibold text-sm sm:hidden">
                  Grand Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-base">
                  {formatINR(purchase.totalPaise)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* Legacy single-item details */
        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Item Details
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
            <div>
              <p className="text-xs text-muted-foreground">Item</p>
              <p className="font-medium">{purchase.itemName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Qty / Unit</p>
              <p className="font-medium tabular-nums">
                {purchase.quantity
                  ? `${Number(purchase.quantity.toString()).toFixed(2)} ${purchase.unit ?? ""}`
                  : "—"}
              </p>
            </div>
            {purchase.ratePaise != null && (
              <div>
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="font-medium tabular-nums">
                  {formatINR(purchase.ratePaise)} / {purchase.unit}
                </p>
              </div>
            )}
            {purchase.discountPercent != null &&
              Number(purchase.discountPercent.toString()) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p className="font-medium">
                    {Number(purchase.discountPercent.toString()).toFixed(2)}%
                  </p>
                </div>
              )}
            {purchase.gstPercent != null && Number(purchase.gstPercent.toString()) > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">GST</p>
                <p className="font-medium">
                  {Number(purchase.gstPercent.toString()).toFixed(2)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="rounded-lg border p-4 text-sm space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Details
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
          <div>
            <p className="text-xs text-muted-foreground">Logged by</p>
            <p className="font-medium">{purchase.loggedBy.name}</p>
          </div>
          {purchase.billPhotoUrl && (
            <div>
              <p className="text-xs text-muted-foreground">Bill</p>
              <a
                href={purchase.billPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 text-xs"
              >
                View bill
              </a>
            </div>
          )}
          {purchase.note && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-muted-foreground">Note</p>
              <p>{purchase.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Payment History</h2>

        {purchase.payments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Method
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Paid By
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">
                    Logged By
                  </th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Proof</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchase.payments.map((pay) => (
                  <tr
                    key={pay.id}
                    className={pay.voidedAt ? "opacity-40 line-through" : "hover:bg-muted/30"}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {pay.paidDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatINR(pay.amountPaidPaise)}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                      {METHOD_LABELS[pay.paymentMethod] ?? pay.paymentMethod}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                      {pay.paidBy?.name ?? "Owner Direct"}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground text-xs">
                      {pay.loggedBy.name}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {pay.paymentProofUrl ? (
                        <a
                          href={pay.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!pay.voidedAt &&
                        !purchase.voidedAt &&
                        currentUser.role === "OWNER" && (
                          <VoidPaymentButton paymentId={pay.id} />
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {purchase.payments.length > 0 && (
          <div className="flex justify-end gap-8 text-sm pr-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="font-semibold tabular-nums text-green-700">{formatINR(totalPaid)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Amount Due</p>
              <p
                className={`font-semibold tabular-nums ${
                  amountDue > 0n ? "text-red-600" : "text-muted-foreground"
                }`}
              >
                {amountDue > 0n ? formatINR(amountDue) : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {canRecord && (
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/purchases">← Back to Purchases</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
