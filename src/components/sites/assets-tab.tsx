"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { voidAssetAllocation } from "@/app/actions/assets";
import { formatINR } from "@/lib/money";

export interface SiteAllocationRow {
  id: string;
  assetId: string;
  assetName: string;
  categoryName: string;
  startDate: string;
  endDate: string | null;
  days: number;
  dailyCostPaise: string | null;
  runningCostPaise: string;
  notes: string | null;
  isVoided: boolean;
}

function VoidAllocationButton({ id, onVoided }: { id: string; onVoided: (id: string) => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 text-xs text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await voidAssetAllocation(id);
          if (result.success) { toast.success("Returned to yard"); onVoided(id); }
          else toast.error(result.error);
        });
      }}
    >
      {isPending ? "…" : "Return to yard"}
    </Button>
  );
}

interface AssetsTabProps {
  currentAllocations: SiteAllocationRow[];
  historicalAllocations: SiteAllocationRow[];
  totalMtdCostPaise: string;
  canManage: boolean;
  siteId: string;
}

export function AssetsTab({
  currentAllocations,
  historicalAllocations,
  totalMtdCostPaise,
  canManage,
}: AssetsTabProps) {
  const totalMtd = BigInt(totalMtdCostPaise);

  return (
    <div className="space-y-6">
      {/* Current assets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Currently at This Site</h3>
          {totalMtd > 0n && (
            <span className="text-xs text-muted-foreground">
              MTD asset cost: <span className="font-medium text-foreground">{formatINR(totalMtd)}</span>
            </span>
          )}
        </div>
        {currentAllocations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No assets currently at this site</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Since</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Days</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Daily</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Running cost</th>
                  {canManage && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentAllocations.map((row) => {
                  const runningCost = BigInt(row.runningCostPaise);
                  const dailyCost = row.dailyCostPaise ? BigInt(row.dailyCostPaise) : null;
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/assets/${row.assetId}`} className="hover:underline text-primary">
                          {row.assetName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{row.categoryName}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{row.startDate}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.days}d</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {dailyCost ? formatINR(dailyCost) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {runningCost > 0n ? formatINR(runningCost) : "—"}
                      </td>
                      {canManage && (
                        <td className="px-1 py-2">
                          <VoidAllocationButton id={row.id} onVoided={() => {}} />
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

      {/* Historical */}
      {historicalAllocations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Historical Allocations</h3>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Start</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">End</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Days</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Total cost</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {historicalAllocations.map((row) => {
                  const cost = BigInt(row.runningCostPaise);
                  return (
                    <tr key={row.id} className={row.isVoided ? "opacity-50" : ""}>
                      <td className="px-3 py-2">
                        <Link href={`/assets/${row.assetId}`} className="hover:underline text-primary font-medium">
                          {row.assetName}
                        </Link>
                        {row.isVoided && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-gray-300 text-gray-400">VOIDED</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.startDate}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.endDate ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.days}d</td>
                      <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                        {cost > 0n && !row.isVoided ? formatINR(cost) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell">{row.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
