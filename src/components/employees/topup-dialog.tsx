"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/money-input";
import { topUpWallet } from "@/app/actions/wallet";
import { toPaise, formatINR } from "@/lib/money";

type ActionResult = { success: true } | { success: false; error: string };

type Props = {
  employeeId: string;
  employeeName: string;
  currentBalancePaise: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computePreview(currentPaise: string, amountStr: string): string | null {
  const trimmed = amountStr.trim();
  if (!trimmed) return null;
  try {
    const added = toPaise(trimmed);
    if (added <= 0n) return null;
    const newBalance = BigInt(currentPaise) + added;
    return formatINR(newBalance);
  } catch {
    return null;
  }
}

export function TopUpDialog({
  employeeId,
  employeeName,
  currentBalancePaise,
  open,
  onOpenChange,
}: Props) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    topUpWallet,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Advance given");
      setAmount("");
      setPaymentDate(todayISO());
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaymentDate(todayISO());
    }
  }, [open]);

  const preview = computePreview(currentBalancePaise, amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Give Advance</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 mt-2">
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <input type="hidden" name="employeeId" value={employeeId} />

          {employeeName && (
            <p className="text-sm text-muted-foreground">
              Advance for{" "}
              <span className="font-medium text-foreground">{employeeName}</span>
            </p>
          )}

          <div className="text-sm">
            <span className="text-muted-foreground">Current balance: </span>
            <span className="font-medium tabular-nums">
              {formatINR(BigInt(currentBalancePaise))}
            </span>
          </div>

          <MoneyInput
            name="amount"
            value={amount}
            onChange={setAmount}
            label="Amount (₹)"
            placeholder="10,000"
          />

          {preview && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">After advance: </span>
              <span className="font-semibold tabular-nums text-green-600">
                {preview}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="topup-date">Payment date</Label>
            <Input
              id="topup-date"
              name="paymentDate"
              type="date"
              value={paymentDate}
              max={todayISO()}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="topup-note">Note (optional)</Label>
            <Textarea
              id="topup-note"
              name="note"
              placeholder="e.g. Advance for site expenses"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              <Wallet className="h-4 w-4 mr-1.5" />
              {isPending ? "Processing…" : "Give Advance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
