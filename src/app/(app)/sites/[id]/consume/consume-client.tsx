"use client";

import { useState, useActionState, useTransition, useEffect, useRef } from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createConsumption, bulkConsumption } from "@/app/actions/material-consumption";
import type { ConsumptionActionResult } from "@/app/actions/material-consumption";
import type { AvailableMaterialItem } from "@/lib/site-materials";

interface ConsumeClientProps {
  siteId: string;
  initialAvailable: AvailableMaterialItem[];
  canConsume: boolean;
}

// ─── Available table ──────────────────────────────────────────────────────────

function AvailableTable({ items }: { items: AvailableMaterialItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">No material at this site yet</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Purchased</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">In</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Out</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Consumed</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Available</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.itemName} className={item.isNegative ? "bg-red-50" : ""}>
              <td className="px-3 py-2 font-medium">
                {item.itemName}
                <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>
                {item.isNegative && (
                  <span className="ml-1.5 text-xs text-red-500 font-normal">⚠ Over-consumed</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {Number(item.totalPurchased).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {Number(item.totalTransferredIn).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {Number(item.totalTransferredOut).toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {Number(item.totalConsumed).toFixed(2)}
              </td>
              <td className={cn(
                "px-3 py-2 text-right tabular-nums font-semibold",
                item.isNegative ? "text-red-600" : ""
              )}>
                {Number(item.available).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Single entry form ────────────────────────────────────────────────────────

function SingleForm({
  siteId,
  available,
  onSuccess,
}: {
  siteId: string;
  available: AvailableMaterialItem[];
  onSuccess: () => void;
}) {
  const [state, action] = useActionState<ConsumptionActionResult | null, FormData>(
    createConsumption,
    null
  );
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedUnit, setSelectedUnit] = useState("");

  useEffect(() => {
    if (state?.success) {
      toast.success("Consumption logged");
      formRef.current?.reset();
      setSelectedUnit("");
      onSuccess();
    }
  }, [state, onSuccess]);

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    const match = available.find((a) => a.itemName === val);
    if (match) setSelectedUnit(match.unit);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <form ref={formRef} action={(fd) => startTransition(() => action(fd))} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Item *</label>
        <input
          name="itemName"
          list="available-items"
          placeholder="Select or type item name"
          required
          onChange={handleItemChange}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <datalist id="available-items">
          {available.map((a) => (
            <option key={a.itemName} value={a.itemName} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Quantity *</label>
          <input
            type="number"
            name="quantity"
            step="0.01"
            min="0.01"
            required
            placeholder="e.g. 2.5"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Unit *</label>
          <input
            name="unit"
            required
            placeholder="e.g. bags"
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Date *</label>
        <input
          type="date"
          name="consumedDate"
          defaultValue={today}
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Note (optional)</label>
        <input
          name="note"
          placeholder="Any notes about the consumption"
          maxLength={200}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Logging…" : "Log Consumption"}
      </Button>
    </form>
  );
}

// ─── Bulk entry form ──────────────────────────────────────────────────────────

interface BulkRow {
  id: number;
  itemName: string;
  quantity: string;
  unit: string;
  error?: string;
}

function BulkForm({
  siteId,
  available,
  onSuccess,
}: {
  siteId: string;
  available: AvailableMaterialItem[];
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>([
    { id: 1, itemName: "", quantity: "", unit: "" },
  ]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(2);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: nextId.current++, itemName: "", quantity: "", unit: "" },
    ]);
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (id: number, field: keyof BulkRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "itemName") {
          const match = available.find((a) => a.itemName === value);
          if (match) updated.unit = match.unit;
        }
        return updated;
      })
    );
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await bulkConsumption(
        siteId,
        rows.map((r) => ({ itemName: r.itemName, quantity: r.quantity, unit: r.unit })),
        date,
        note || undefined
      );
      if (result.success) {
        toast.success(`${result.count} item${result.count !== 1 ? "s" : ""} logged`);
        setRows([{ id: nextId.current++, itemName: "", quantity: "", unit: "" }]);
        setNote("");
        onSuccess();
      } else {
        setError(result.error);
        if (result.fieldErrors) {
          setRows((prev) =>
            prev.map((r, i) => ({
              ...r,
              error: result.fieldErrors![`row_${i}`],
            }))
          );
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Date + note */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date *</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Applies to all rows"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Row table — cards on mobile, table on desktop */}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Row {idx + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3 sm:col-span-1">
                <input
                  list={`items-${row.id}`}
                  value={row.itemName}
                  onChange={(e) => updateRow(row.id, "itemName", e.target.value)}
                  placeholder="Item name"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <datalist id={`items-${row.id}`}>
                  {available.map((a) => (
                    <option key={a.itemName} value={a.itemName} />
                  ))}
                </datalist>
              </div>
              <div>
                <input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                  step="0.01"
                  min="0.01"
                  placeholder="Qty"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <input
                  value={row.unit}
                  onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                  placeholder="Unit"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
            {row.error && <p className="text-xs text-red-600">{row.error}</p>}
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addRow}
          disabled={rows.length >= 50}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add item
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={isPending || rows.length === 0}
      >
        {isPending ? "Submitting…" : `Log ${rows.length} item${rows.length !== 1 ? "s" : ""}`}
      </Button>
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function ConsumeClient({ siteId, initialAvailable, canConsume }: ConsumeClientProps) {
  const [available, setAvailable] = useState<AvailableMaterialItem[]>(initialAvailable);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAvailable = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/site-materials/${siteId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailable(data.items);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Available table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Available at This Site</h2>
          <button
            onClick={refreshAvailable}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        </div>
        <AvailableTable items={available} />
      </div>

      {/* Consumption form */}
      {canConsume && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Log Consumption</h2>
          <Tabs defaultValue="single">
            <TabsList className="w-full">
              <TabsTrigger value="single" className="flex-1">Single Entry</TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">Bulk Entry</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-4">
              <SingleForm
                siteId={siteId}
                available={available}
                onSuccess={refreshAvailable}
              />
            </TabsContent>
            <TabsContent value="bulk" className="mt-4">
              <BulkForm
                siteId={siteId}
                available={available}
                onSuccess={refreshAvailable}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
