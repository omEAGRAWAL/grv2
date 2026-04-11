import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { CreateVendorDialog } from "@/components/vendors/create-vendor-dialog";
import { VendorsTable } from "@/components/vendors/vendors-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vendors — ConstructHub" };

export default async function VendorsPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const [vendors, purchaseAggs] = await Promise.all([
    db.vendor.findMany({ orderBy: { name: "asc" } }),
    db.purchase.groupBy({
      by: ["vendorId"],
      _sum: { totalPaise: true },
      where: { voidedAt: null },
    }),
  ]);

  const spendMap = new Map(
    purchaseAggs.map((r) => [r.vendorId, r._sum.totalPaise ?? 0n])
  );

  const rows = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    contactPhone: v.contactPhone,
    gstin: v.gstin,
    totalPurchasedFormatted: formatINR(spendMap.get(v.id) ?? 0n),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Vendors</h1>
        <CreateVendorDialog />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No vendors yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first vendor using the button above.
          </p>
        </div>
      ) : (
        <VendorsTable rows={rows} />
      )}
    </div>
  );
}
