import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New Purchase — ConstructHub" };

export default async function PurchaseNewPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; site?: string }>;
}) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const sp = await searchParams;

  const [vendors, sites, users] = await Promise.all([
    db.vendor.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.site.findMany({
      where: { status: "ACTIVE", companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { isActive: true, companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">New Purchase</h1>
      <PurchaseForm
        vendors={vendors}
        sites={sites}
        users={users}
        defaultVendorId={sp.vendor}
        defaultSiteId={sp.site}
      />
    </div>
  );
}
