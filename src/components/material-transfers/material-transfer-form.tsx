"use client";

import { useActionState, useState, useTransition } from "react";
import Decimal from "decimal.js";
import {
  createMaterialTransfer,
  getAvailableMaterialAction,
} from "@/app/actions/material-transfers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvailableItem } from "@/lib/material";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

type SiteOption = { id: string; name: string };

type Props = {
  sites: SiteOption[];
  initialSourceId: string; // "CENTRAL_STORE" or a site id
  initialMaterial: AvailableItem[];
};

function formatINRSimple(paise: string): string {
  const n = Number(paise) / 100;
  if (n <= 0) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

type ActionResult = { success: false; error: string };

export function MaterialTransferForm({
  sites,
  initialSourceId,
  initialMaterial,
}: Props) {
  const [fromSourceId, setFromSourceId] = useState(initialSourceId);
  const [toSiteId, setToSiteId] = useState("");
  const [material, setMaterial] = useState<AvailableItem[]>(initialMaterial);
  const [selectedItem, setSelectedItem] = useState<AvailableItem | null>(null);
  const [qty, setQty] = useState("");
  const [isFetchingMaterial, startFetch] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  // Compute cost that will move (proportional)
  const costMoved = (() => {
    if (!selectedItem || !qty) return null;
    try {
      const qD = new Decimal(qty);
      const available = new Decimal(selectedItem.availableQty);
      if (qD.lte(0) || available.lte(0)) return null;
      if (qD.gt(available)) return null;
      const cost = new Decimal(selectedItem.totalCostPaise)
        .times(qD)
        .div(available)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      return cost.toString();
    } catch {
      return null;
    }
  })();

  const qtyExceedsAvailable = (() => {
    if (!selectedItem || !qty) return false;
    try {
      return new Decimal(qty).gt(new Decimal(selectedItem.availableQty));
    } catch {
      return false;
    }
  })();

  // To options: all sites except the selected "from" site
  const toOptions = sites.filter(
    (s) => s.id !== (fromSourceId === "CENTRAL_STORE" ? "" : fromSourceId)
  );

  function handleFromChange(newFrom: string) {
    setFromSourceId(newFrom);
    setSelectedItem(null);
    setQty("");
    const resolvedId = newFrom === "CENTRAL_STORE" ? null : newFrom;
    startFetch(async () => {
      const items = await getAvailableMaterialAction(resolvedId);
      setMaterial(items);
    });
  }

  function handleItemSelect(itemName: string) {
    const item = material.find((m) => m.itemName === itemName) ?? null;
    setSelectedItem(item);
    setQty("");
  }

  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(createMaterialTransfer, null);

  const error = state && !state.success ? state.error : null;

  const canSubmit =
    fromSourceId &&
    toSiteId &&
    selectedItem &&
    qty &&
    !qtyExceedsAvailable &&
    !isPending;

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden resolved values */}
      <input type="hidden" name="fromSourceId" value={fromSourceId} />
      <input type="hidden" name="toSiteId" value={toSiteId} />
      <input type="hidden" name="itemName" value={selectedItem?.itemName ?? ""} />
      <input type="hidden" name="quantity" value={qty} />
      <input type="hidden" name="unit" value={selectedItem?.unit ?? ""} />

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* From / To */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>From *</Label>
          <Select value={fromSourceId} onValueChange={handleFromChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select source…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CENTRAL_STORE">Central Store</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>To (Site) *</Label>
          <Select value={toSiteId} onValueChange={setToSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination site…" />
            </SelectTrigger>
            <SelectContent>
              {toOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Available at Source */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Available at Source
          {isFetchingMaterial && (
            <span className="ml-2 text-xs text-muted-foreground">
              Loading…
            </span>
          )}
        </p>
        {material.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No material available at this location
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Item
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Qty Available
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Total Cost
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Avg/Unit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {material.map((item) => (
                  <tr
                    key={item.itemName}
                    className={`cursor-pointer transition-colors ${
                      selectedItem?.itemName === item.itemName
                        ? "bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleItemSelect(item.itemName)}
                  >
                    <td className="px-3 py-2 font-medium">{item.itemName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {new Decimal(item.availableQty).toFixed(2)} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatINRSimple(item.totalCostPaise)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatINRSimple(item.avgCostPerUnitPaise)}/{item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item + Quantity */}
      {selectedItem && (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium">{selectedItem.itemName}</p>
            <p className="text-muted-foreground text-xs">
              Available:{" "}
              {new Decimal(selectedItem.availableQty).toFixed(2)}{" "}
              {selectedItem.unit} ·{" "}
              {formatINRSimple(selectedItem.totalCostPaise)} total
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mt-qty">
              Quantity to Transfer ({selectedItem.unit}) *
            </Label>
            <Input
              id="mt-qty"
              type="number"
              step="any"
              min="0.0001"
              max={selectedItem.availableQty}
              placeholder={`Max ${new Decimal(selectedItem.availableQty).toFixed(2)}`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={qtyExceedsAvailable ? "border-destructive" : ""}
            />
            {qtyExceedsAvailable && (
              <p className="text-xs text-destructive">
                Exceeds available quantity (
                {new Decimal(selectedItem.availableQty).toFixed(2)}{" "}
                {selectedItem.unit})
              </p>
            )}
          </div>

          {costMoved && (
            <div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost to move</span>
                <span className="font-semibold tabular-nums">
                  {formatINRSimple(costMoved)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Proportional to quantity transferred
              </p>
            </div>
          )}
        </div>
      )}

      {/* Date + Note */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="mt-date">Transfer Date *</Label>
          <Input
            id="mt-date"
            name="transferDate"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mt-note">Note</Label>
          <Textarea
            id="mt-note"
            name="note"
            placeholder="Optional note…"
            rows={1}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className="w-full"
        size="lg"
      >
        {isPending ? "Transferring…" : "Transfer Material"}
      </Button>
    </form>
  );
}
