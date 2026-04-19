"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { toast } from "sonner";
import { createAssetAllocation } from "@/app/actions/assets";
import type { AllocationActionResult } from "@/app/actions/assets";

interface Site { id: string; name: string }

interface AllocateDialogProps {
  assetId: string;
  assetName: string;
  defaultDailyCostPaise: bigint | null;
  currentSiteId: string | null;
  sites: Site[];
  trigger: React.ReactNode;
  onSuccess?: () => void;
  // For supervisor: only show their assigned sites
  assignedSiteIds?: string[];
}

function AllocateForm({
  assetId,
  assetName,
  defaultDailyCostPaise,
  currentSiteId,
  sites,
  assignedSiteIds,
  close,
  onSuccess,
}: AllocateDialogProps & { close: () => void }) {
  const [state, action] = useActionState<AllocationActionResult | null, FormData>(
    createAssetAllocation,
    null
  );
  const [isPending, startTransition] = useTransition();
  const [advanced, setAdvanced] = useState(false);
  const [overrideCost, setOverrideCost] = useState(false);
  const [includeInPL, setIncludeInPL] = useState(!!defaultDailyCostPaise);

  const today = new Date().toISOString().split("T")[0];
  const maxBackdate = new Date();
  maxBackdate.setDate(maxBackdate.getDate() - 90);
  const minDate = maxBackdate.toISOString().split("T")[0];

  const visibleSites = assignedSiteIds
    ? sites.filter((s) => assignedSiteIds.includes(s.id))
    : sites;

  useEffect(() => {
    if (state?.success) {
      toast.success(`${assetName} moved successfully`);
      close();
      onSuccess?.();
    }
  }, [state, assetName, close, onSuccess]);

  return (
    <form action={(fd) => startTransition(() => action(fd))} className="space-y-4 mt-2">
      <input type="hidden" name="assetId" value={assetId} />

      {/* Destination */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Move to *</label>
        <select
          name="siteId"
          defaultValue={currentSiteId ?? ""}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          required={false}
        >
          <option value="">Return to yard (idle)</option>
          {visibleSites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Toggle advanced */}
      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {advanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {advanced ? "Hide options" : "Show more options"}
      </button>

      {advanced && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
          {/* Start date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start date</label>
            <input
              type="date"
              name="startDate"
              defaultValue={today}
              min={minDate}
              max={today}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">Backdating auto-closes any current open allocation the day before.</p>
          </div>

          {/* Cost override */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={overrideCost}
                onChange={(e) => setOverrideCost(e.target.checked)}
                className="rounded"
              />
              Override daily cost
            </label>
            {defaultDailyCostPaise && !overrideCost && (
              <p className="text-xs text-muted-foreground">
                Default: ₹{(Number(defaultDailyCostPaise) / 100).toFixed(0)}/day
              </p>
            )}
            {overrideCost && (
              <input
                type="number"
                name="dailyCostPaise"
                min="1"
                step="1"
                placeholder="Daily cost in paise (e.g. 500000 = ₹5,000)"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Include in P&L */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="includeInSiteCost"
              value="true"
              checked={includeInPL}
              onChange={(e) => setIncludeInPL(e.target.checked)}
              className="rounded"
            />
            Include this cost in site P&L
          </label>
          {!includeInPL && <input type="hidden" name="includeInSiteCost" value="false" />}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="Any notes about this allocation"
              className="w-full rounded-md border px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* Hidden defaults when not in advanced mode */}
      {!advanced && (
        <>
          <input type="hidden" name="startDate" value={today} />
          <input type="hidden" name="includeInSiteCost" value={includeInPL ? "true" : "false"} />
        </>
      )}

      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Moving…" : "Move Asset"}
        </Button>
      </div>
    </form>
  );
}

export function AllocateDialog(props: AllocateDialogProps) {
  return (
    <FormDialog trigger={props.trigger} title={`Move ${props.assetName}`}>
      {({ close }) => <AllocateForm {...props} close={close} />}
    </FormDialog>
  );
}
