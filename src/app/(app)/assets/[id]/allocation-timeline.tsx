"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { voidAssetAllocation } from "@/app/actions/assets";
import { formatINR } from "@/lib/money";

interface AllocationRow {
  id: string;
  assetId: string;
  siteId: string | null;
  siteName: string | null;
  sitePageId: string | null;
  startDate: string;
  endDate: string | null;
  days: number;
  costPaise: string;
  hasCost: boolean;
  notes: string | null;
  loggedByName: string;
  isOpen: boolean;
  isVoided: boolean;
}

function VoidAllocDialog({
  row,
  onVoided,
}: {
  row: AllocationRow;
  onVoided: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const costPaise = BigInt(row.costPaise);

  const handleVoid = () => {
    startTransition(async () => {
      const result = await voidAssetAllocation(row.id);
      if (result.success) {
        toast.success("Allocation voided");
        setOpen(false);
        onVoided();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Void
      </Button>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Void this allocation?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Period: {row.startDate} — {row.endDate ?? "ongoing"}</p>
          <p>Site: {row.siteName ?? "Yard"}</p>
          {costPaise > 0n && (
            <p className="text-amber-700 font-medium">
              This will reduce the site P&L by approximately {formatINR(costPaise)}.
            </p>
          )}
          <p className="text-xs">This action cannot be undone.</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={handleVoid} disabled={isPending}>
            {isPending ? "Voiding…" : "Void"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllocationRow({ row, canVoid, onVoided }: { row: AllocationRow; canVoid: boolean; onVoided: () => void }) {
  const costPaise = BigInt(row.costPaise);
  return (
    <div className={`px-4 py-3 flex items-start gap-3 text-sm ${row.isVoided ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          {row.siteName && row.sitePageId ? (
            <Link href={`/sites/${row.sitePageId}`} className="font-medium text-primary hover:underline">
              {row.siteName}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground italic">Yard</span>
          )}
          {row.isOpen && !row.isVoided && (
            <Badge className="text-[10px] px-1.5 py-0">Current</Badge>
          )}
          {row.isVoided && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-300">Voided</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {row.startDate} — {row.endDate ?? "ongoing"} · {row.days}d
          {costPaise > 0n && !row.isVoided && (
            <> · <span className="font-medium text-foreground">{formatINR(costPaise)}</span></>
          )}
        </p>
        {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}
      </div>
      {canVoid && !row.isVoided && (
        <VoidAllocDialog row={row} onVoided={onVoided} />
      )}
    </div>
  );
}

interface AllocationTimelineProps {
  active: AllocationRow[];
  voided: AllocationRow[];
  canVoid: boolean;
}

export function AllocationTimeline({ active, voided, canVoid }: AllocationTimelineProps) {
  const [showVoided, setShowVoided] = useState(false);

  if (active.length === 0 && voided.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Allocation History</h2>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No allocations yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Allocation History</h2>
      <div className="rounded-lg border divide-y">
        {active.map((row) => (
          <AllocationRow key={row.id} row={row} canVoid={canVoid} onVoided={() => {}} />
        ))}
      </div>

      {voided.length > 0 && (
        <div className="space-y-1">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowVoided((v) => !v)}
          >
            {showVoided ? "Hide" : "Show"} {voided.length} voided allocation{voided.length !== 1 ? "s" : ""}
          </button>
          {showVoided && (
            <div className="rounded-lg border divide-y">
              {voided.map((row) => (
                <AllocationRow key={row.id} row={row} canVoid={false} onVoided={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
