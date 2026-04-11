import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSites } from "@/lib/sites";
import { getBatchSiteSpend, getBatchSiteIncome } from "@/lib/site-financials";
import { formatINR } from "@/lib/money";
import { CreateSiteDialog } from "@/components/sites/create-site-dialog";
import { SiteFilter } from "@/components/sites/site-filter";
import { SitesTable } from "@/components/sites/sites-table";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sites — ConstructHub" };

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");

  const { status } = await searchParams;
  const sites = await getSites(status);

  const siteIds = sites.map((s) => s.id);
  const [spendMap, incomeMap] = await Promise.all([
    getBatchSiteSpend(siteIds),
    getBatchSiteIncome(siteIds),
  ]);

  const rows = sites.map((s) => {
    const spent = spendMap.get(s.id) ?? 0n;
    const received = incomeMap.get(s.id) ?? 0n;
    const pnl = received - spent;
    return {
      id: s.id,
      name: s.name,
      clientName: s.clientName,
      contractFormatted: formatINR(s.contractValuePaise),
      receivedFormatted: formatINR(received),
      spentFormatted: formatINR(spent),
      plFormatted:
        pnl >= 0n ? `+${formatINR(pnl)}` : `−${formatINR(-pnl)}`,
      plPositive: pnl >= 0n,
      status: s.status,
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Sites</h1>
        <div className="flex items-center gap-2">
          <SiteFilter current={status} />
          {currentUser.role === "OWNER" && <CreateSiteDialog />}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm font-medium">
            {status
              ? `No ${status.toLowerCase().replace("_", " ")} sites`
              : "No sites yet"}
          </p>
          {!status && currentUser.role === "OWNER" && (
            <p className="text-xs text-muted-foreground mt-1">
              Create your first site using the button above.
            </p>
          )}
        </div>
      ) : (
        <SitesTable rows={rows} />
      )}
    </div>
  );
}
