"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import Decimal from "decimal.js";
import { CalendarIcon, ChevronDown, Plus, Trash2 } from "lucide-react";
import { createPurchase } from "@/app/actions/purchases";
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
import { CreateVendorDialog } from "@/components/vendors/create-vendor-dialog";
import { BillPhotoUpload } from "@/components/expense/bill-photo-upload";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

type VendorOption = { id: string; name: string };
type SiteOption = { id: string; name: string };
type UserOption = { id: string; name: string };
type MaterialOption = { id: string; name: string; unit: string };

type Props = {
  vendors: VendorOption[];
  sites: SiteOption[];
  users: UserOption[];
  materials: MaterialOption[];
  defaultVendorId?: string;
  defaultSiteId?: string;
};

type LineItemRow = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  rateRupees: string;
  discountPercent: string;
  gstPercent: string;
  materialId: string;
};

function newRow(): LineItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    itemName: "",
    quantity: "",
    unit: "",
    rateRupees: "",
    discountPercent: "0",
    gstPercent: "18",
    materialId: "",
  };
}

function formatINRSimple(paise: bigint): string {
  if (paise <= 0n) return "₹0.00";
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

function calcBreakdown(qty: string, rateRupees: string, discountPct: string, gstPct: string) {
  try {
    const qD = new Decimal(qty || "0");
    const rD = new Decimal(rateRupees || "0");
    const dD = new Decimal(discountPct || "0").div(100);
    const gD = new Decimal(gstPct || "0").div(100);
    if (qD.lte(0) || rD.lte(0)) return null;
    const subtotal = qD.times(rD);
    const discountAmt = subtotal.times(dD);
    const afterDiscount = subtotal.minus(discountAmt);
    const gstAmt = afterDiscount.times(gD);
    const total = afterDiscount.plus(gstAmt);
    const toPaiseBigInt = (d: Decimal) =>
      BigInt(d.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
    return {
      subtotalPaise: toPaiseBigInt(subtotal),
      discountPaise: toPaiseBigInt(discountAmt),
      gstPaise: toPaiseBigInt(gstAmt),
      totalPaise: toPaiseBigInt(total),
    };
  } catch {
    return null;
  }
}

type ActionResult = { success: false; error: string };

// ─── Item Combobox ────────────────────────────────────────────────────────────

function ItemCombobox({
  materials,
  value,
  onValueChange,
  onUnitChange,
  onMaterialIdChange,
}: {
  materials: MaterialOption[];
  value: string;
  onValueChange: (v: string) => void;
  onUnitChange: (unit: string) => void;
  onMaterialIdChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? materials.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
    : materials;

  const exactMatch = materials.find(
    (m) => m.name.toLowerCase() === query.trim().toLowerCase()
  );

  function select(name: string, unit: string, materialId: string) {
    onValueChange(name);
    onUnitChange(unit);
    onMaterialIdChange(materialId);
    setQuery(name);
    setOpen(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onValueChange(query);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [query, onValueChange]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onValueChange(e.target.value);
            onMaterialIdChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="e.g. Cement"
          className="pr-8"
          autoComplete="off"
        />
        <ChevronDown className="absolute right-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && (filtered.length > 0 || (!exactMatch && query.trim())) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-52 overflow-auto text-sm">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                select(m.name, m.unit, m.id);
              }}
            >
              <span>{m.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{m.unit}</span>
            </button>
          ))}
          {!exactMatch && query.trim() && (
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 hover:bg-accent text-left text-primary"
              onMouseDown={(e) => {
                e.preventDefault();
                select(query.trim(), "", "");
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add new: &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single line item row ─────────────────────────────────────────────────────

function LineItemRowComponent({
  row,
  index,
  materials,
  canRemove,
  onChange,
  onRemove,
}: {
  row: LineItemRow;
  index: number;
  materials: MaterialOption[];
  canRemove: boolean;
  onChange: (id: string, patch: Partial<LineItemRow>) => void;
  onRemove: (id: string) => void;
}) {
  const breakdown = calcBreakdown(row.quantity, row.rateRupees, row.discountPercent, row.gstPercent);

  return (
    <div className="rounded-lg border p-3 space-y-3 relative">
      {canRemove && (
        <button
          type="button"
          aria-label="Remove item"
          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(row.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Item Name *</Label>
          <ItemCombobox
            materials={materials}
            value={row.itemName}
            onValueChange={(v) => onChange(row.id, { itemName: v })}
            onUnitChange={(u) => { if (u) onChange(row.id, { unit: u }); }}
            onMaterialIdChange={(id) => onChange(row.id, { materialId: id })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Qty *</Label>
          <Input
            type="number"
            step="any"
            min="0.0001"
            placeholder="100"
            value={row.quantity}
            onChange={(e) => onChange(row.id, { quantity: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit *</Label>
          <Input
            placeholder="bags / kg / nos"
            value={row.unit}
            onChange={(e) => onChange(row.id, { unit: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Rate (₹) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="350.00"
              className="pl-6"
              value={row.rateRupees}
              onChange={(e) => onChange(row.id, { rateRupees: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Disc %</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0"
            value={row.discountPercent}
            onChange={(e) => onChange(row.id, { discountPercent: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">GST %</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="18"
            value={row.gstPercent}
            onChange={(e) => onChange(row.id, { gstPercent: e.target.value })}
          />
        </div>
      </div>

      {breakdown && (
        <div className="text-right text-sm font-semibold text-primary">
          Line total: {formatINRSimple(breakdown.totalPaise)}
        </div>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function PurchaseForm({
  vendors: initialVendors,
  sites,
  users,
  materials,
  defaultVendorId,
  defaultSiteId,
}: Props) {
  const [vendors, setVendors] = useState(initialVendors);
  const [purchaseType, setPurchaseType] = useState<"VENDOR" | "LOCAL">("VENDOR");
  const [vendorId, setVendorId] = useState(defaultVendorId ?? "");
  const [sellerName, setSellerName] = useState("");
  const [destination, setDestination] = useState(defaultSiteId ?? "CENTRAL_STORE");
  const [lineItems, setLineItems] = useState<LineItemRow[]>([newRow()]);

  const [billPhoto, setBillPhoto] = useState<{ secure_url: string; public_id: string } | null>(null);

  const [payFull, setPayFull] = useState(true);
  const [ipMethod, setIpMethod] = useState("CASH");
  const [ipPaidBy, setIpPaidBy] = useState("OWNER_DIRECT");
  const [ipPartialAmount, setIpPartialAmount] = useState("");
  const [ipProof, setIpProof] = useState<{ secure_url: string; public_id: string } | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createPurchase,
    null
  );
  const error = state && !state.success ? state.error : null;

  function updateRow(id: string, patch: Partial<LineItemRow>) {
    setLineItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setLineItems((rows) => rows.filter((r) => r.id !== id));
  }

  function addRow() {
    if (lineItems.length < 20) setLineItems((rows) => [...rows, newRow()]);
  }

  function handleVendorCreated(newVendorId: string, newVendorName: string) {
    setVendors((prev) => [...prev, { id: newVendorId, name: newVendorName }]);
    setVendorId(newVendorId);
  }

  const grandTotalPaise = lineItems.reduce((sum, row) => {
    const bd = calcBreakdown(row.quantity, row.rateRupees, row.discountPercent, row.gstPercent);
    return sum + (bd?.totalPaise ?? 0n);
  }, 0n);

  const ipAmount = payFull
    ? grandTotalPaise > 0n
      ? (Number(grandTotalPaise) / 100).toFixed(2)
      : ""
    : ipPartialAmount;

  const lineItemsJsonValue = JSON.stringify(
    lineItems.map((r) => ({
      itemName: r.itemName,
      quantity: r.quantity,
      unit: r.unit,
      rateRupees: r.rateRupees,
      discountPercent: r.discountPercent || "0",
      gstPercent: r.gstPercent || "0",
      ...(r.materialId ? { materialId: r.materialId } : {}),
    }))
  );

  const canSubmit =
    !isPending &&
    (purchaseType === "LOCAL" || !!vendorId) &&
    lineItems.every(
      (r) => r.itemName.trim() && r.unit.trim() && calcBreakdown(r.quantity, r.rateRupees, r.discountPercent, r.gstPercent)
    ) &&
    grandTotalPaise > 0n;

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields */}
      <input type="hidden" name="purchaseType" value={purchaseType} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="sellerName" value={sellerName} />
      <input type="hidden" name="destinationSiteId" value={destination} />
      <input type="hidden" name="lineItemsJson" value={lineItemsJsonValue} />
      {billPhoto && (
        <>
          <input type="hidden" name="billPhotoUrl" value={billPhoto.secure_url} />
          <input type="hidden" name="billPhotoPublicId" value={billPhoto.public_id} />
        </>
      )}
      {ipAmount && (
        <>
          <input type="hidden" name="ipAmount" value={ipAmount} />
          <input type="hidden" name="ipMethod" value={ipMethod} />
          <input type="hidden" name="ipPaidByUserId" value={ipPaidBy} />
          {ipProof && (
            <>
              <input type="hidden" name="ipProofUrl" value={ipProof.secure_url} />
              <input type="hidden" name="ipProofPublicId" value={ipProof.public_id} />
            </>
          )}
        </>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
      )}

      {/* Purchase type toggle */}
      <div className="space-y-1.5">
        <Label>Purchase Type</Label>
        <div className="flex rounded-md border overflow-hidden w-fit">
          <button
            type="button"
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              purchaseType === "VENDOR"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setPurchaseType("VENDOR")}
          >
            Vendor
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              purchaseType === "LOCAL"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setPurchaseType("LOCAL")}
          >
            Local / Cash
          </button>
        </div>
      </div>

      {/* Row 1: Vendor OR Seller + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {purchaseType === "VENDOR" ? (
          <div className="space-y-1.5">
            <Label>Vendor *</Label>
            <div className="flex gap-2">
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select vendor…" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CreateVendorDialog
                onCreated={handleVendorCreated}
                trigger={
                  <Button type="button" variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="pf-seller">Seller Name</Label>
            <Input
              id="pf-seller"
              placeholder="e.g. Local hardware shop"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pf-date">Purchase Date *</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="pf-date"
              name="purchaseDate"
              type="date"
              defaultValue={today}
              className="pl-9"
              required
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <Label>Items *</Label>
        {lineItems.map((row, idx) => (
          <LineItemRowComponent
            key={row.id}
            row={row}
            index={idx}
            materials={materials}
            canRemove={lineItems.length > 1}
            onChange={updateRow}
            onRemove={removeRow}
          />
        ))}

        {lineItems.length < 20 && (
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add another item
          </Button>
        )}

        {/* Grand total */}
        {grandTotalPaise > 0n && (
          <div className="rounded-lg bg-muted/50 border px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Grand Total ({lineItems.length} {lineItems.length === 1 ? "item" : "items"})
            </span>
            <span className="text-lg font-bold tabular-nums">
              {formatINRSimple(grandTotalPaise)}
            </span>
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="space-y-1.5">
        <Label>Destination *</Label>
        <Select value={destination} onValueChange={setDestination}>
          <SelectTrigger>
            <SelectValue />
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

      {/* Bill Photo */}
      <BillPhotoUpload value={billPhoto} onChange={setBillPhoto} />

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="pf-note">Note</Label>
        <Textarea
          id="pf-note"
          name="note"
          placeholder="Any additional details…"
          rows={2}
        />
      </div>

      {/* Initial Payment Section */}
      <details open className="rounded-lg border p-4 space-y-4">
        <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between">
          <span>Initial Payment</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>

        <div className="pt-3 space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="pf-pay-full"
              type="checkbox"
              checked={payFull}
              onChange={(e) => {
                setPayFull(e.target.checked);
                if (e.target.checked) setIpPartialAmount("");
              }}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="pf-pay-full" className="font-normal cursor-pointer">
              Mark as paid in full now?
              {grandTotalPaise > 0n && payFull && (
                <span className="ml-1 text-muted-foreground text-xs">
                  ({formatINRSimple(grandTotalPaise)})
                </span>
              )}
            </Label>
          </div>

          {!payFull && (
            <div className="space-y-1.5">
              <Label htmlFor="pf-ip-amount">Amount Paying Now (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  ₹
                </span>
                <Input
                  id="pf-ip-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={ipPartialAmount}
                  onChange={(e) => setIpPartialAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to record the purchase as Unpaid
              </p>
            </div>
          )}

          {(payFull || ipPartialAmount) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pf-ip-date">Payment Date</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="pf-ip-date"
                    name="ipDate"
                    type="date"
                    defaultValue={today}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={ipMethod} onValueChange={setIpMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Paid By</Label>
                <Select value={ipPaidBy} onValueChange={setIpPaidBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER_DIRECT">Owner Direct (cash)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ipPaidBy !== "OWNER_DIRECT" && (
                  <p className="text-xs text-muted-foreground">
                    Will debit this person&apos;s wallet
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <BillPhotoUpload value={ipProof} onChange={setIpProof} />
                {ipProof && (
                  <>
                    <input type="hidden" name="ipProofUrl" value={ipProof.secure_url} />
                    <input type="hidden" name="ipProofPublicId" value={ipProof.public_id} />
                  </>
                )}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="pf-ip-notes">Payment Notes</Label>
                <Input
                  id="pf-ip-notes"
                  name="ipNotes"
                  placeholder="Reference number, cheque number, etc."
                />
              </div>
            </div>
          )}
        </div>
      </details>

      <Button type="submit" disabled={!canSubmit} className="w-full" size="lg">
        {isPending ? "Creating Purchase…" : "Create Purchase"}
      </Button>
    </form>
  );
}
