"use client";

import { useActionState, useState } from "react";
import Decimal from "decimal.js";
import { CalendarIcon, Plus } from "lucide-react";
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

type Props = {
  vendors: VendorOption[];
  sites: SiteOption[];
  users: UserOption[];
  defaultVendorId?: string;
  defaultSiteId?: string;
};

function formatINRSimple(paise: bigint): string {
  if (paise <= 0n) return "₹0.00";
  const rupees = Number(paise) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

function calcBreakdown(
  qty: string,
  rateRupees: string,
  discountPct: string,
  gstPct: string
) {
  try {
    const qD = new Decimal(qty || "0");
    const rD = new Decimal(rateRupees || "0");
    const dD = new Decimal(discountPct || "0").div(100);
    const gD = new Decimal(gstPct || "0").div(100);

    if (qD.lte(0) || rD.lte(0)) return null;

    const subtotal = qD.times(rD); // in rupees
    const discountAmt = subtotal.times(dD);
    const afterDiscount = subtotal.minus(discountAmt);
    const gstAmt = afterDiscount.times(gD);
    const total = afterDiscount.plus(gstAmt);

    const toPaiseBigInt = (d: Decimal) =>
      BigInt(d.times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());

    return {
      subtotalPaise: toPaiseBigInt(subtotal),
      discountPaise: toPaiseBigInt(discountAmt),
      afterDiscountPaise: toPaiseBigInt(afterDiscount),
      gstPaise: toPaiseBigInt(gstAmt),
      totalPaise: toPaiseBigInt(total),
    };
  } catch {
    return null;
  }
}

type ActionResult = { success: false; error: string };

export function PurchaseForm({
  vendors: initialVendors,
  sites,
  users,
  defaultVendorId,
  defaultSiteId,
}: Props) {
  const [vendors, setVendors] = useState(initialVendors);
  const [vendorId, setVendorId] = useState(defaultVendorId ?? "");
  const [destination, setDestination] = useState(
    defaultSiteId ?? "CENTRAL_STORE"
  );
  const [paidBy, setPaidBy] = useState("OWNER_DIRECT");

  // Purchase math state
  const [qty, setQty] = useState("");
  const [rateRupees, setRateRupees] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [gstPct, setGstPct] = useState("18");

  // Bill photo
  const [billPhoto, setBillPhoto] = useState<{ secure_url: string; public_id: string } | null>(null);

  // Today in YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];

  const breakdown = calcBreakdown(qty, rateRupees, discountPct, gstPct);

  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(createPurchase, null);

  const error = state && !state.success ? state.error : null;

  function handleVendorCreated(newVendorId: string, newVendorName: string) {
    setVendors((prev) => [...prev, { id: newVendorId, name: newVendorName }]);
    setVendorId(newVendorId);
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden fields for resolved values */}
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="destinationSiteId" value={destination} />
      <input type="hidden" name="paidByUserId" value={paidBy} />

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Row 1: Vendor + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Row 2: Item + Qty + Unit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 space-y-1.5">
          <Label htmlFor="pf-item">Item Name *</Label>
          <Input
            id="pf-item"
            name="itemName"
            placeholder="e.g. Cement 50kg bags"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-qty">Quantity *</Label>
          <Input
            id="pf-qty"
            name="quantity"
            type="number"
            step="any"
            min="0.0001"
            placeholder="e.g. 100"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-unit">Unit *</Label>
          <Input
            id="pf-unit"
            name="unit"
            placeholder="bags / kg / ton / nos"
            required
          />
        </div>
      </div>

      {/* Row 3: Rate + Discount + GST */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pf-rate">Rate per Unit (₹) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              ₹
            </span>
            <Input
              id="pf-rate"
              name="rateRupees"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="350.00"
              className="pl-7"
              value={rateRupees}
              onChange={(e) => setRateRupees(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-discount">Discount %</Label>
          <div className="relative">
            <Input
              id="pf-discount"
              name="discountPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              className="pr-7"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-gst">GST %</Label>
          <div className="relative">
            <Input
              id="pf-gst"
              name="gstPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="18"
              className="pr-7"
              value={gstPct}
              onChange={(e) => setGstPct(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Price Breakdown */}
      {breakdown && (
        <div className="rounded-lg bg-muted/50 border p-4 space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Price Breakdown
          </p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">
              {formatINRSimple(breakdown.subtotalPaise)}
            </span>
          </div>
          {breakdown.discountPaise > 0n && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({discountPct}%)</span>
              <span className="tabular-nums">
                −{formatINRSimple(breakdown.discountPaise)}
              </span>
            </div>
          )}
          {breakdown.gstPaise > 0n && (
            <div className="flex justify-between text-orange-600">
              <span>GST ({gstPct}%)</span>
              <span className="tabular-nums">
                +{formatINRSimple(breakdown.gstPaise)}
              </span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">
              {formatINRSimple(breakdown.totalPaise)}
            </span>
          </div>
        </div>
      )}

      {/* Row 4: Destination + Paid By */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="space-y-1.5">
          <Label>Paid By *</Label>
          <Select value={paidBy} onValueChange={setPaidBy}>
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
          {paidBy !== "OWNER_DIRECT" && (
            <p className="text-xs text-muted-foreground">
              Will debit this person&apos;s wallet
            </p>
          )}
        </div>
      </div>

      {/* Bill Photo — renders its own hidden inputs when a photo is set */}
      <BillPhotoUpload
        value={billPhoto}
        onChange={setBillPhoto}
      />

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

      <Button
        type="submit"
        disabled={isPending || !vendorId || !breakdown}
        className="w-full"
        size="lg"
      >
        {isPending ? "Creating Purchase…" : "Create Purchase"}
      </Button>
    </form>
  );
}
