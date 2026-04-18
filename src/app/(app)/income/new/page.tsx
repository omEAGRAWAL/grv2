import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { IncomeForm } from "@/components/incomes/income-form";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Record Income — ConstructHub" };

export default async function IncomeNewPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const owner = await requireOwner().catch(() => null);
  if (!owner) redirect("/login");

  const { site: defaultSiteId } = await searchParams;

  const sites = await db.site.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (sites.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Record Income</h1>
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No active sites. Create a site first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Record Income</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record client payments received for a site.
        </p>
      </div>
      <IncomeForm
        sites={sites}
        defaultSiteId={defaultSiteId ?? sites[0]?.id}
      />
    </div>
  );
}
