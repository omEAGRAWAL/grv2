import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllocationDays, getAllocationCostPaise, getEffectiveDailyCost } from "@/lib/assets";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AllocateDialog } from "@/components/assets/allocate-dialog";
import { AllocationTimeline } from "./allocation-timeline";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { formatINR } from "@/lib/money";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id }, select: { name: true } });
  return { title: asset ? `${asset.name} — ConstructHub` : "Asset" };
}

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700",
  MAINTENANCE: "bg-yellow-100 text-yellow-700",
  DECOMMISSIONED: "bg-gray-100 text-gray-500",
};

export default async function AssetDetailPage({ params }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role === "WORKER" || currentUser.role === "EMPLOYEE") redirect("/dashboard");

  const { id } = await params;
  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  const canManage = ["OWNER", "SITE_MANAGER"].includes(currentUser.role);

  const [asset, categories, activeSites] = await Promise.all([
    db.asset.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        allocations: {
          orderBy: { startDate: "desc" },
          include: {
            site: { select: { id: true, name: true } },
            loggedBy: { select: { name: true } },
          },
        },
      },
    }),
    canManage ? db.assetCategory.findMany({ where: { companyId: companyId ?? "" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.site.findMany({
      where: { companyId: companyId ?? "", status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!asset || asset.companyId !== companyId) notFound();

  const today = new Date();
  const monthStart = startOfMonth(today);
  const daysInMonth = getDaysInMonth(today);

  // Find open allocation
  const openAlloc = asset.allocations.find((a) => a.endDate === null && a.voidedAt === null) ?? null;
  const currentSite = openAlloc
    ? (openAlloc as typeof openAlloc & { site: { id: string; name: string } | null }).site
    : null;

  // Running cost for open allocation
  const openCostPaise = openAlloc
    ? getAllocationCostPaise(openAlloc, asset, today)
    : 0n;

  // Days since allocation started
  const daysAtSite = openAlloc
    ? differenceInCalendarDays(today, new Date(openAlloc.startDate)) + 1
    : null;

  // Utilization this month: count days within month where asset was allocated (to any site)
  let daysAllocatedThisMonth = 0;
  let mtdCostPaise = 0n;

  for (const alloc of asset.allocations) {
    if (alloc.voidedAt) continue;
    const allocStart = new Date(alloc.startDate);
    const allocEnd = alloc.endDate ? new Date(alloc.endDate) : today;
    const overlapStart = allocStart < monthStart ? monthStart : allocStart;
    const overlapEnd = allocEnd > today ? today : allocEnd;
    if (overlapStart <= overlapEnd) {
      daysAllocatedThisMonth += differenceInCalendarDays(overlapEnd, overlapStart) + 1;
    }
    // MTD cost: only for site allocations with cost
    if (alloc.siteId && alloc.includeInSiteCost) {
      const rate = getEffectiveDailyCost(alloc, asset);
      if (rate) {
        const effectiveStart = allocStart < monthStart ? monthStart : allocStart;
        const effectiveEnd = allocEnd > today ? today : allocEnd;
        if (effectiveStart <= effectiveEnd) {
          const days = differenceInCalendarDays(effectiveEnd, effectiveStart) + 1;
          mtdCostPaise += rate * BigInt(days);
        }
      }
    }
  }

  const utilizationPct = Math.min(Math.round((daysAllocatedThisMonth / daysInMonth) * 100), 100);

  // Split allocations: active (non-voided) and voided
  const activeAllocations = asset.allocations.filter((a) => !a.voidedAt);
  const voidedAllocations = asset.allocations.filter((a) => a.voidedAt);

  // Serialize for client component
  const serialize = (a: typeof asset.allocations[number]) => ({
    id: a.id,
    assetId: id,
    siteId: a.siteId,
    siteName: (a as typeof a & { site?: { id: string; name: string } | null }).site?.name ?? null,
    sitePageId: (a as typeof a & { site?: { id: string; name: string } | null }).site?.id ?? null,
    startDate: a.startDate.toISOString().split("T")[0],
    endDate: a.endDate ? a.endDate.toISOString().split("T")[0] : null,
    days: getAllocationDays(a, today),
    costPaise: String(getAllocationCostPaise(a, asset, today)),
    hasCost: getEffectiveDailyCost(a, asset) !== null && a.includeInSiteCost,
    notes: a.notes,
    loggedByName: (a as typeof a & { loggedBy: { name: string } }).loggedBy.name,
    isOpen: a.endDate === null,
    isVoided: a.voidedAt !== null,
  });

  const assignedSiteIds =
    currentUser.role === "SUPERVISOR"
      ? (
          await db.siteAssignment.findMany({
            where: { userId: currentUser.id },
            select: { siteId: true },
          })
        ).map((a) => a.siteId)
      : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/assets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Assets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{asset.name}</h1>
            <Badge variant="outline" className="text-xs">{asset.ownershipType === "OWNED" ? "Owned" : "Rented"}</Badge>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[asset.status]}`}>
              {asset.status === "DECOMMISSIONED" ? "Retired" : asset.status === "MAINTENANCE" ? "Maintenance" : "Available"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{asset.category.name}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <AssetFormDialog
              categories={categories}
              existing={{
                id: asset.id,
                name: asset.name,
                categoryId: asset.categoryId,
                ownershipType: asset.ownershipType,
                defaultDailyCostPaise: asset.defaultDailyCostPaise,
                status: asset.status,
                notes: asset.notes,
                photoUrl: asset.photoUrl,
                photoPublicId: asset.photoPublicId,
              }}
              trigger={<Button variant="outline" size="sm">Edit</Button>}
            />
            {asset.status !== "DECOMMISSIONED" && (
              <AllocateDialog
                assetId={asset.id}
                assetName={asset.name}
                defaultDailyCostPaise={asset.defaultDailyCostPaise}
                currentSiteId={currentSite?.id ?? null}
                sites={activeSites}
                trigger={<Button size="sm">Move to site</Button>}
              />
            )}
          </div>
        )}
      </div>

      {/* Location + Utilization cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {asset.status === "MAINTENANCE" ? (
              <p className="font-semibold text-yellow-700">Under maintenance</p>
            ) : currentSite ? (
              <>
                <Link href={`/sites/${currentSite.id}`} className="font-semibold text-primary hover:underline">
                  {currentSite.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Allocated since {new Date(openAlloc!.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {" "}({daysAtSite}d)
                </p>
                {openCostPaise > 0n && (
                  <p className="text-sm text-muted-foreground">
                    Running cost: <span className="font-medium text-foreground">{formatINR(openCostPaise)}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-muted-foreground italic">Idle — in yard/store</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilization This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">{utilizationPct}%</p>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {daysAllocatedThisMonth} / {daysInMonth} days allocated
            </p>
            {mtdCostPaise > 0n && (
              <p className="text-xs text-muted-foreground">
                MTD cost: <span className="font-medium">{formatINR(mtdCostPaise)}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation timeline */}
      <AllocationTimeline
        active={activeAllocations.map(serialize)}
        voided={voidedAllocations.map(serialize)}
        canVoid={canManage}
      />
    </div>
  );
}
