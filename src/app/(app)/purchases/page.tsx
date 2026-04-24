import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Purchases — ConstructHub" };

type Props = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const PAGE_SIZE = 25;

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
] as const;

function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Paid</Badge>;
  if (status === "PARTIAL")
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Unpaid</Badge>;
}

function TypeBadge({ type }: { type: string }) {
  if (type === "LOCAL")
    return (
      <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 ml-1">
        Local
      </Badge>
    );
  return null;
}

type PurchaseRow = {
  id: string;
  purchaseDate: Date;
  purchaseType: string;
  totalPaise: bigint;
  paymentStatus: string;
  vendorId: string | null;
  itemName: string | null;
  quantity: { toString: () => string } | null;
  unit: string | null;
  sellerName: string | null;
  vendor: { id: string; name: string } | null;
  payments: { amountPaidPaise: bigint }[];
  lineItems: { itemName: string; quantity: { toString: () => string }; unit: string }[];
};

function getItemDisplay(p: PurchaseRow): { label: string; subLabel: string } {
  if (p.lineItems.length > 0) {
    const first = p.lineItems[0];
    const label =
      p.lineItems.length > 1
        ? `${first.itemName} +${p.lineItems.length - 1} more`
        : first.itemName;
    const subLabel =
      p.lineItems.length === 1
        ? `${Number(first.quantity.toString()).toFixed(2)} ${first.unit}`
        : `${p.lineItems.length} items`;
    return { label, subLabel };
  }
  return {
    label: p.itemName ?? "(items)",
    subLabel: p.quantity ? `${Number(p.quantity.toString()).toFixed(2)} ${p.unit ?? ""}` : "",
  };
}

function getSourceDisplay(p: PurchaseRow): { href: string | null; name: string } {
  if (p.vendor) return { href: `/vendors/${p.vendor.id}`, name: p.vendor.name };
  return { href: null, name: p.sellerName ?? "LOCAL" };
}

export default async function PurchasesPage({ searchParams }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const sp = await searchParams;
  const statusFilter = sp.status ?? "ALL";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    companyId,
    voidedAt: null,
    ...(statusFilter !== "ALL" ? { paymentStatus: statusFilter as "UNPAID" | "PARTIAL" | "PAID" } : {}),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const [totalCount, purchases, dueAgg] = await Promise.all([
    db.purchase.count({ where }),
    anyDb.purchase.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        payments: { where: { voidedAt: null }, select: { amountPaidPaise: true } },
        lineItems: {
          orderBy: { displayOrder: "asc" },
          select: { itemName: true, quantity: true, unit: true },
        },
      },
      orderBy: [{ paymentStatus: "asc" }, { purchaseDate: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }) as Promise<PurchaseRow[]>,
    db.purchase.findMany({
      where: { companyId, voidedAt: null, paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      include: { payments: { where: { voidedAt: null }, select: { amountPaidPaise: true } } },
      select: { totalPaise: true, payments: true },
    }),
  ]);

  const totalDues = dueAgg.reduce((sum, p) => {
    const paid = p.payments.reduce((s: bigint, py: { amountPaidPaise: bigint }) => s + py.amountPaidPaise, 0n);
    return sum + (p.totalPaise - paid);
  }, 0n);

  const hasNext = page * PAGE_SIZE < totalCount;
  const hasPrev = page > 1;

  function pageUrl(p: number) {
    const q = new URLSearchParams();
    if (statusFilter !== "ALL") q.set("status", statusFilter);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return `/purchases${qs ? `?${qs}` : ""}`;
  }

  function filterUrl(s: string) {
    return s === "ALL" ? "/purchases" : `/purchases?status=${s}`;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Purchases</h1>
          {totalDues > 0n && (
            <p className="text-sm text-red-600 font-medium mt-0.5">
              Total pending dues: {formatINR(totalDues)}
            </p>
          )}
        </div>
        <Button asChild size="sm">
          <Link href="/purchases/new">
            <Plus className="h-4 w-4 mr-1.5" />
            New Purchase
          </Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={filterUrl(opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium text-sm">No purchases found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "ALL"
              ? `No ${statusFilter.toLowerCase()} purchases.`
              : "Create your first purchase to get started."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Paid
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Due
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((p) => {
                  const paid = p.payments.reduce((s, py) => s + py.amountPaidPaise, 0n);
                  const due = p.totalPaise - paid;
                  const { label, subLabel } = getItemDisplay(p);
                  const source = getSourceDisplay(p);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {p.purchaseDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        {source.href ? (
                          <Link href={source.href} className="hover:underline text-primary text-xs">
                            {source.name}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">{source.name}</span>
                        )}
                        <TypeBadge type={p.purchaseType} />
                      </td>
                      <td className="px-3 py-2 font-medium max-w-[160px] truncate">
                        <Link href={`/purchases/${p.id}`} className="hover:underline">
                          {label}
                        </Link>
                        {subLabel && (
                          <div className="text-xs text-muted-foreground">{subLabel}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatINR(p.totalPaise)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700 hidden sm:table-cell">
                        {paid > 0n ? formatINR(paid) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 hidden sm:table-cell">
                        {due > 0n ? formatINR(due) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PaymentBadge status={p.paymentStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <div className="flex gap-2">
                {hasPrev && (
                  <Link href={pageUrl(page - 1)} className="text-xs underline underline-offset-2">
                    ← Previous
                  </Link>
                )}
                {hasNext && (
                  <Link href={pageUrl(page + 1)} className="text-xs underline underline-offset-2">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
