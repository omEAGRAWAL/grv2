"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { toast } from "sonner";
import { createAsset, updateAsset } from "@/app/actions/assets";
import type { AssetActionResult } from "@/app/actions/assets";

interface Category { id: string; name: string }

interface ExistingAsset {
  id: string;
  name: string;
  categoryId: string;
  ownershipType: "OWNED" | "RENTED";
  defaultDailyCostPaise: bigint | null;
  status: "AVAILABLE" | "MAINTENANCE" | "DECOMMISSIONED";
  notes: string | null;
  photoUrl: string | null;
  photoPublicId: string | null;
}

interface AssetFormProps {
  categories: Category[];
  existing?: ExistingAsset;
  close: () => void;
  onCreated?: (id: string) => void;
}

function AssetForm({ categories, existing, close, onCreated }: AssetFormProps) {
  const action = existing ? updateAsset : createAsset;
  const [state, formAction] = useActionState<AssetActionResult | null, FormData>(action, null);
  const [isPending, startTransition] = useTransition();
  const [costPaise, setCostPaise] = useState(
    existing?.defaultDailyCostPaise ? String(existing.defaultDailyCostPaise) : ""
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(existing ? "Asset updated" : "Asset created");
      if (!existing && "id" in state && state.id) onCreated?.(state.id);
      close();
    }
  }, [state, existing, close, onCreated]);

  const costRupees = costPaise ? (Number(costPaise) / 100).toFixed(0) : "";

  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="space-y-4 mt-2">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      {existing?.photoUrl && <input type="hidden" name="photoUrl" value={existing.photoUrl} />}
      {existing?.photoPublicId && <input type="hidden" name="photoPublicId" value={existing.photoPublicId} />}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Name *</label>
        <input
          name="name"
          defaultValue={existing?.name}
          required
          maxLength={100}
          placeholder="e.g. JCB-01"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Category *</label>
        <select
          name="categoryId"
          defaultValue={existing?.categoryId ?? ""}
          required
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="" disabled>Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Ownership *</label>
        <div className="flex gap-4">
          {(["OWNED", "RENTED"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="ownershipType"
                value={type}
                defaultChecked={existing ? existing.ownershipType === type : type === "OWNED"}
                required
              />
              {type === "OWNED" ? "Owned" : "Rented"}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Default daily cost (optional)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <input
            type="number"
            min="0"
            step="1"
            value={costRupees}
            onChange={(e) => setCostPaise(e.target.value ? String(Math.round(Number(e.target.value) * 100)) : "")}
            placeholder="No cost tracked"
            className="w-full rounded-md border px-3 py-2 pl-7 text-sm"
          />
        </div>
        <input type="hidden" name="defaultDailyCostPaise" value={costPaise} />
        <p className="text-xs text-muted-foreground">Applied automatically when allocated. Can be overridden per allocation.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Status</label>
        <select
          name="status"
          defaultValue={existing?.status ?? "AVAILABLE"}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="AVAILABLE">Available</option>
          <option value="MAINTENANCE">Under Maintenance</option>
          <option value="DECOMMISSIONED">Decommissioned</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes (optional)</label>
        <textarea
          name="notes"
          defaultValue={existing?.notes ?? ""}
          maxLength={500}
          rows={2}
          placeholder="Any notes about this asset"
          className="w-full rounded-md border px-3 py-2 text-sm resize-none"
        />
      </div>

      {state && !state.success && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={close}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Saving…" : existing ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}

interface AssetFormDialogProps {
  categories: Category[];
  existing?: ExistingAsset;
  trigger: React.ReactNode;
  onCreated?: (id: string) => void;
}

export function AssetFormDialog({ categories, existing, trigger, onCreated }: AssetFormDialogProps) {
  return (
    <FormDialog trigger={trigger} title={existing ? "Edit Asset" : "Add Asset"}>
      {({ close }) => (
        <AssetForm categories={categories} existing={existing} close={close} onCreated={onCreated} />
      )}
    </FormDialog>
  );
}
