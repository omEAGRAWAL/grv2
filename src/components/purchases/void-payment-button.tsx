"use client";

import { useState } from "react";
import { voidPurchasePayment } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (!confirm("Void this payment? Any linked wallet debit will be reversed.")) return;
    setPending(true);
    const result = await voidPurchasePayment(paymentId);
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Payment voided");
    }
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive text-xs h-7 px-2"
      onClick={handle}
      disabled={pending}
    >
      {pending ? "…" : "Void"}
    </Button>
  );
}
