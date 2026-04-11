"use client";

import { useActionState } from "react";
import { createVendor, updateVendor } from "@/app/actions/vendors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ActionResult =
  | { success: true; vendorId: string; vendorName: string }
  | { success: false; error: string };

type VendorData = {
  id: string;
  name: string;
  contactPhone: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
};

type Props = {
  vendor?: VendorData; // undefined = create mode
  onSuccess?: (vendorId: string, vendorName: string) => void;
};

export function VendorForm({ vendor, onSuccess }: Props) {
  const action = vendor ? updateVendor : createVendor;
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.success && onSuccess) {
        onSuccess(result.vendorId, result.vendorName);
      }
      return result;
    },
    null
  );

  const error = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="space-y-4">
      {vendor && <input type="hidden" name="vendorId" value={vendor.id} />}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="vf-name">Vendor Name *</Label>
        <Input
          id="vf-name"
          name="name"
          defaultValue={vendor?.name ?? ""}
          placeholder="e.g. Shree Cement Suppliers"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="vf-phone">Contact Phone</Label>
          <Input
            id="vf-phone"
            name="contactPhone"
            type="tel"
            defaultValue={vendor?.contactPhone ?? ""}
            placeholder="9876543210"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vf-gstin">GSTIN</Label>
          <Input
            id="vf-gstin"
            name="gstin"
            defaultValue={vendor?.gstin ?? ""}
            placeholder="29ABCDE1234F1Z5"
            className="uppercase"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vf-address">Address</Label>
        <Textarea
          id="vf-address"
          name="address"
          defaultValue={vendor?.address ?? ""}
          placeholder="Vendor address"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vf-notes">Notes</Label>
        <Textarea
          id="vf-notes"
          name="notes"
          defaultValue={vendor?.notes ?? ""}
          placeholder="Any additional notes"
          rows={2}
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending
          ? vendor
            ? "Saving…"
            : "Creating…"
          : vendor
            ? "Save Changes"
            : "Create Vendor"}
      </Button>
    </form>
  );
}
