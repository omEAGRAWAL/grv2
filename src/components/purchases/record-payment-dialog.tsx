"use client";

import { useActionState, useState } from "react";
import { CalendarIcon, Plus } from "lucide-react";
import { addPurchasePayment } from "@/app/actions/purchases";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BillPhotoUpload } from "@/components/expense/bill-photo-upload";

type UserOption = { id: string; name: string };

type Props = {
  purchaseId: string;
  remainingPaise: bigint;
  users: UserOption[];
};

type ActionResult = { success: false; error: string } | { success: true };

export function RecordPaymentDialog({ purchaseId, remainingPaise, users }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const remainingRupees = (Number(remainingPaise) / 100).toFixed(2);

  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Record Payment
        </Button>
      }
      title="Record Payment"
    >
      {({ close }) => (
        <RecordPaymentForm
          purchaseId={purchaseId}
          remainingRupees={remainingRupees}
          users={users}
          today={today}
          onSuccess={close}
        />
      )}
    </FormDialog>
  );
}

function RecordPaymentForm({
  purchaseId,
  remainingRupees,
  users,
  today,
  onSuccess,
}: {
  purchaseId: string;
  remainingRupees: string;
  users: UserOption[];
  today: string;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState("CASH");
  const [paidBy, setPaidBy] = useState("OWNER_DIRECT");
  const [proof, setProof] = useState<{ secure_url: string; public_id: string } | null>(null);

  async function action(_prev: ActionResult | null, formData: FormData) {
    const result = await addPurchasePayment(_prev, formData);
    if (result.success) onSuccess();
    return result;
  }

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );
  const error = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <input type="hidden" name="paymentMethod" value={method} />
      <input type="hidden" name="paidByUserId" value={paidBy} />
      {proof && (
        <>
          <input type="hidden" name="proofUrl" value={proof.secure_url} />
          <input type="hidden" name="proofPublicId" value={proof.public_id} />
        </>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rp-amount">Amount (₹) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
            <Input
              id="rp-amount"
              name="amountRupees"
              type="number"
              step="0.01"
              min="0.01"
              max={remainingRupees}
              placeholder={remainingRupees}
              className="pl-7"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Max: ₹{remainingRupees}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rp-date">Payment Date *</Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="rp-date"
              name="paidDate"
              type="date"
              defaultValue={today}
              className="pl-9"
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Payment Method *</Label>
        <Select value={method} onValueChange={setMethod}>
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
          <p className="text-xs text-muted-foreground">Will debit this person&apos;s wallet</p>
        )}
      </div>

      <BillPhotoUpload value={proof} onChange={setProof} />

      <div className="space-y-1.5">
        <Label htmlFor="rp-notes">Notes</Label>
        <Input
          id="rp-notes"
          name="notes"
          placeholder="Cheque no., UPI ref., etc."
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Recording…" : "Record Payment"}
      </Button>
    </form>
  );
}
