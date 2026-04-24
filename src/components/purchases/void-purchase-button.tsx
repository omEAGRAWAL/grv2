"use client";

import { useState } from "react";
import { voidPurchase } from "@/app/actions/purchases";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VoidPurchaseButton({ purchaseId }: { purchaseId: string }) {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (!confirm("Void this purchase? This will reverse all linked wallet payments.")) return;
    setPending(true);
    const result = await voidPurchase(purchaseId);
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Purchase voided");
    }
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handle}
      disabled={pending}
    >
      {pending ? "Voiding…" : "Void Purchase"}
    </Button>
  );
}
