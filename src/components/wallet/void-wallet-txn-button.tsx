"use client";

import { voidWalletTransaction } from "@/app/actions/wallet";
import { VoidButton } from "@/components/void-button";

export function VoidWalletTxnButton({ txnId }: { txnId: string }) {
  return (
    <VoidButton
      action={voidWalletTransaction.bind(null, txnId)}
      label="Void Transaction"
    />
  );
}
