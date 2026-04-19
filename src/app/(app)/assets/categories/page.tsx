import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoriesClient } from "./categories-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Asset Categories — ConstructHub" };

export default async function CategoriesPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (!["OWNER", "SITE_MANAGER"].includes(currentUser.role)) redirect("/assets");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const categories = await db.assetCategory.findMany({
    where: { companyId },
    include: { _count: { select: { assets: true } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Asset Categories</h1>
      </div>
      <CategoriesClient categories={categories} />
    </div>
  );
}
