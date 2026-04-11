"use client";

import { useState, useTransition } from "react";
import { Calculator, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/money";
import type { ReconcileBreakdown } from "@/lib/wallet-reconcile";

// ─── Server action (fetches breakdown on demand) ───────────────────────────────

async function fetchReconcile(userId: string): Promise<ReconcileBreakdown> {
  const res = await fetch(`/api/wallet/reconcile?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("Failed to load reconciliation");
  const data = await res.json();
  // Convert stringified BigInts back
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? BigInt(v) : v])
  ) as ReconcileBreakdown;
}

type Props = {
  userId: string;
  basePath: string; // for "Show all transactions" link
};

function Row({
  label,
  amount,
  count,
  indent = false,
}: {
  label: string;
  amount: bigint;
  count: number;
  indent?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className={`flex justify-between text-sm ${indent ? "pl-4 text-muted-foreground" : "font-medium"}`}>
      <span>
        {label}
        <span className="ml-1 text-xs text-muted-foreground font-normal">
          ({count} txn{count !== 1 ? "s" : ""})
        </span>
      </span>
      <span className="tabular-nums">{formatINR(amount)}</span>
    </div>
  );
}

export function ReconcileModal({ userId, basePath }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReconcileBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !data) {
      startTransition(async () => {
        try {
          const result = await fetchReconcile(userId);
          setData(result);
        } catch {
          setError("Failed to load reconciliation data. Try again.");
        }
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calculator className="h-4 w-4" />
          Reconcile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Wallet Reconciliation</DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && !isPending && (
          <div className="space-y-4">
            {/* Credits */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-green-700">
                <span>Total Credits</span>
                <span className="tabular-nums">+{formatINR(data.totalCredits)}</span>
              </div>
              <Row label="Top-ups" amount={data.topupTotal} count={data.topupCount} indent />
              <Row label="Transfers in" amount={data.transferInTotal} count={data.transferInCount} indent />
              {data.reversalCreditCount > 0 && (
                <Row label="Reversals (credit)" amount={data.reversalCreditTotal} count={data.reversalCreditCount} indent />
              )}
            </div>

            <div className="border-t" />

            {/* Debits */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold text-red-700">
                <span>Total Debits</span>
                <span className="tabular-nums">−{formatINR(data.totalDebits)}</span>
              </div>
              <Row label="Expenses" amount={data.expenseTotal} count={data.expenseCount} indent />
              <Row label="Transfers out" amount={data.transferOutTotal} count={data.transferOutCount} indent />
              <Row label="Vendor payments" amount={data.vendorPaymentTotal} count={data.vendorPaymentCount} indent />
              {data.reversalDebitCount > 0 && (
                <Row label="Reversals (debit)" amount={data.reversalDebitTotal} count={data.reversalDebitCount} indent />
              )}
            </div>

            <div className="border-t" />

            {/* Balance */}
            <div className="flex justify-between items-center">
              <span className="font-semibold text-base">Balance</span>
              <span
                className={`text-xl font-bold tabular-nums ${
                  data.balance >= 0n ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatINR(data.balance)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Credits − Debits = {formatINR(data.totalCredits)} − {formatINR(data.totalDebits)} = {formatINR(data.balance)}
            </p>

            <Link
              href={basePath}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 text-xs text-primary underline underline-offset-2 hover:opacity-80"
            >
              Show all transactions
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
