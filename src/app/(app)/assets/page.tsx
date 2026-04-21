import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCurrentLocation } from "@/lib/assets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AllocateDialog } from "@/components/assets/allocate-dialog";
import { differenceInCalendarDays } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Assets — ConstructHub" };

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-yellow-100 text-yellow-700",
  DECOMMISSIONED: "bg-gray-100 text-gray-500",
};

export default async function AssetsPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role === "WORKER" || currentUser.role === "EMPLOYEE") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const canManage = ["OWNER", "SITE_MANAGER"].includes(currentUser.role);

  const [assets, categories, activeSites, assignedSiteIds] = await Promise.all([
    db.asset.findMany({
      where: { companyId },
      include: {
        category: { select: { name: true } },
        allocations: {
          where: { endDate: null, voidedAt: null },
          include: { site: { select: { id: true, name: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    canManage
      ? db.assetCategory.findMany({ where: { companyId }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    db.site.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    currentUser.role === "SUPERVISOR"
      ? db.siteAssignment.findMany({
          where: { userId: currentUser.id, companyId },
          select: { siteId: true },
        }).then((r) => r.map((a) => a.siteId))
      : Promise.resolve(null),
  ]);

  const today = new Date();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Assets</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button asChild variant="outline" size="sm">
              <Link href="/assets/categories">Categories</Link>
            </Button>
          )}
          {canManage && (
            <AssetFormDialog
              categories={categories}
              trigger={<Button size="sm">+ Add Asset</Button>}
            />
          )}
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <p className="font-medium text-sm">No assets yet</p>
          {canManage && (
            <p className="text-sm text-muted-foreground">Add your first asset to start tracking its location and cost.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Ownership</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Location</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Days here</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                {(canManage || currentUser.role === "SUPERVISOR") && (
                  <th className="px-3 py-2" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {assets.map((asset) => {
                const openAlloc = asset.allocations[0] ?? null;
                const site = (openAlloc as typeof openAlloc & { site?: { id: string; name: string } | null })?.site ?? null;
                const daysHere = openAlloc
                  ? differenceInCalendarDays(today, new Date(openAlloc.startDate)) + 1
                  : null;

                const canAllocate =
                  canManage ||
                  (currentUser.role === "SUPERVISOR" &&
                    (site === null || (assignedSiteIds && assignedSiteIds.includes(site.id))));

                return (
                  <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                        {asset.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{asset.category.name}</td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {asset.ownershipType === "OWNED" ? "Owned" : "Rented"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {asset.status === "MAINTENANCE" ? (
                        <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">Maintenance</Badge>
                      ) : site ? (
                        <Link href={`/sites/${site.id}`} className="text-primary hover:underline text-xs font-medium">
                          {site.name}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Idle</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {daysHere !== null ? `${daysHere}d` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[asset.status] ?? ""}`}>
                        {asset.status === "DECOMMISSIONED" ? "Retired" : asset.status === "MAINTENANCE" ? "Maintenance" : "Available"}
                      </span>
                    </td>
                    {(canManage || currentUser.role === "SUPERVISOR") && (
                      <td className="px-3 py-2 text-right">
                        {asset.status !== "DECOMMISSIONED" && canAllocate && (
                          <AllocateDialog
                            assetId={asset.id}
                            assetName={asset.name}
                            defaultDailyCostPaise={asset.defaultDailyCostPaise}
                            currentSiteId={site?.id ?? null}
                            sites={activeSites}
                            assignedSiteIds={assignedSiteIds ?? undefined}
                            trigger={
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                Move
                              </Button>
                            }
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
