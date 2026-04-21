"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/money-input";
import { createSalaryPayment } from "@/app/actions/payroll";
import { toPaise, formatINR } from "@/lib/money";

type ActionResult = { success: true } | { success: false; error: string };

type Props = {
  employeeId: string;
  employeeName: string;
  outstandingAdvancePaise: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SalaryPaymentDialog({
  employeeId,
  employeeName,
  outstandingAdvancePaise,
  open,
  onOpenChange,
}: Props) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [recoverEnabled, setRecoverEnabled] = useState(false);
  const [recoverAmount, setRecoverAmount] = useState("");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createSalaryPayment,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Salary payment recorded");
      setAmount("");
      setRecoverAmount("");
      setRecoverEnabled(false);
      setPaymentDate(todayISO());
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  useEffect(() => {
    if (open) {
      setAmount("");
      setRecoverAmount("");
      setRecoverEnabled(false);
      setPaymentDate(todayISO());
    }
  }, [open]);

  const outstanding = BigInt(outstandingAdvancePaise);

  let recoverPaise = 0n;
  try {
    if (recoverAmount.trim()) recoverPaise = toPaise(recoverAmount);
  } catch {
    // ignore parse errors while typing
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay Salary</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 mt-2">
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <input type="hidden" name="employeeId" value={employeeId} />

          <p className="text-sm text-muted-foreground">
            Salary for{" "}
            <span className="font-medium text-foreground">{employeeName}</span>
          </p>

          <MoneyInput
            name="amountPaise"
            value={amount}
            onChange={setAmount}
            label="Salary amount (₹)"
            placeholder="20,000"
          />
          {/* Hidden field with paise value derived from amount string */}
          <input
            type="hidden"
            name="amountPaise"
            value={(() => {
              try {
                return amount.trim() ? String(toPaise(amount)) : "";
              } catch {
                return "";
              }
            })()}
          />

          <div className="space-y-1.5">
            <Label htmlFor="salary-date">Payment date</Label>
            <Input
              id="salary-date"
              name="paymentDate"
              type="date"
              value={paymentDate}
              max={todayISO()}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={recoverEnabled}
                onChange={(e) => setRecoverEnabled(e.target.checked)}
                className="rounded"
              />
              Recover advance from this payment
            </label>

            {recoverEnabled && (
              <div className="pl-5 space-y-2">
                <MoneyInput
                  name="recoverAdvancePaise"
                  value={recoverAmount}
                  onChange={setRecoverAmount}
                  label="Recovery amount (₹)"
                  placeholder="5,000"
                />
                {/* Hidden field with paise value */}
                <input
                  type="hidden"
                  name="recoverAdvancePaise"
                  value={(() => {
                    try {
                      return recoverAmount.trim() ? String(toPaise(recoverAmount)) : "0";
                    } catch {
                      return "0";
                    }
                  })()}
                />
                {outstanding > 0n && (
                  <p className="text-xs text-muted-foreground">
                    Outstanding advance:{" "}
                    <span className="font-medium text-amber-600">
                      {formatINR(outstanding)}
                    </span>
                  </p>
                )}
                {recoverPaise > outstanding && outstanding > 0n && (
                  <p className="text-xs text-destructive">
                    Recovery exceeds outstanding advance
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salary-note">Note (optional)</Label>
            <Textarea
              id="salary-note"
              name="note"
              placeholder="e.g. April 2026 salary"
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
              <IndianRupee className="h-4 w-4 mr-1.5" />
              {isPending ? "Saving…" : "Pay Salary"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
