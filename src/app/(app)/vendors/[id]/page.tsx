import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Phone, MapPin, FileText, ShoppingCart, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditVendorDialog } from "@/components/vendors/edit-vendor-dialog";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await db.vendor.findUnique({ where: { id }, select: { name: true } });
  return { title: vendor ? `${vendor.name} — ConstructHub` : "Vendor" };
}

export default async function VendorDetailPage({ params, searchParams }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor) notFound();

  const [totalAgg, purchaseCount, purchases] = await Promise.all([
    db.purchase.aggregate({
      _sum: { totalPaise: true },
      where: { vendorId: id, voidedAt: null },
    }),
    db.purchase.count({ where: { vendorId: id, voidedAt: null } }),
    db.purchase.findMany({
      where: { vendorId: id, voidedAt: null },
      include: {
        destinationSite: { select: { id: true, name: true } },
        paidBy: { select: { name: true } },
      },
      orderBy: { purchaseDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPurchased = totalAgg._sum.totalPaise ?? 0n;
  const hasNext = page * PAGE_SIZE < purchaseCount;
  const hasPrev = page > 1;

  function pageUrl(p: number) {
    return p === 1 ? `/vendors/${id}` : `/vendors/${id}?page=${p}`;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{vendor.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            {vendor.contactPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {vendor.contactPhone}
              </span>
            )}
            {vendor.gstin && (
              <span className="flex items-center gap-1 font-mono text-xs">
                GSTIN: {vendor.gstin}
              </span>
            )}
            {vendor.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {vendor.address}
              </span>
            )}
          </div>
          {vendor.notes && (
            <p className="mt-2 text-sm text-muted-foreground flex items-start gap-1">
              <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {vendor.notes}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/purchases/new?vendor=${id}`}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Purchase
            </Link>
          </Button>
          <EditVendorDialog
            vendor={{
              id: vendor.id,
              name: vendor.name,
              contactPhone: vendor.contactPhone,
              gstin: vendor.gstin,
              address: vendor.address,
              notes: vendor.notes,
            }}
          />
        </div>
      </div>

      {/* Total purchased card */}
      <Card className="max-w-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Total Purchased
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {formatINR(totalPurchased)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {purchaseCount} purchase{purchaseCount !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Purchase history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Purchase History</h2>
        </div>

        {purchases.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No purchases from this vendor yet
            </p>
          </div>
        ) : (
          <>
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
                      Destination
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                      Paid By
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {p.purchaseDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <div>{p.itemName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.unit}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(p.quantity).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatINR(p.totalPaise)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {p.destinationSite ? (
                          <Link
                            href={`/sites/${p.destinationSite.id}`}
                            className="hover:underline"
                          >
                            {p.destinationSite.name}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Central Store
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {p.paidBy ? (
                          p.paidBy.name
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Owner Direct
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {p.billPhotoUrl && (
                          <a
                            href={p.billPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            Bill
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(hasPrev || hasNext) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {Math.ceil(purchaseCount / PAGE_SIZE)}
                </span>
                <div className="flex gap-2">
                  {hasPrev && (
                    <Link
                      href={pageUrl(page - 1)}
                      className="text-xs underline underline-offset-2"
                    >
                      ← Previous
                    </Link>
                  )}
                  {hasNext && (
                    <Link
                      href={pageUrl(page + 1)}
                      className="text-xs underline underline-offset-2"
                    >
                      Next →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
