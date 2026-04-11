"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { toPaise, formatINR } from "@/lib/money";
import { createTransfer } from "@/app/actions/transfers";

type ActionResult = { success: false; error: string };

type User = { id: string; name: string };

type Props = {
  activeUsers: User[];
  currentUserId: string;
  isOwner: boolean;
  walletBalances: Record<string, string>; // userId → paise string
};

function computePreview(
  balancePaise: string | undefined,
  amountStr: string
): string | null {
  if (!balancePaise) return null;
  const trimmed = amountStr.trim();
  if (!trimmed) return null;
  try {
    const sent = toPaise(trimmed);
    if (sent <= 0n) return null;
    const remaining = BigInt(balancePaise) - sent;
    return formatINR(remaining);
  } catch {
    return null;
  }
}

export function TransferForm({
  activeUsers,
  currentUserId,
  isOwner,
  walletBalances,
}: Props) {
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createTransfer,
    null
  );

  let amountPaiseStr = "";
  try {
    if (amount.trim()) amountPaiseStr = toPaise(amount).toString();
  } catch {
    /* invalid */
  }

  const fromBalance = walletBalances[fromUserId];
  const preview = computePreview(fromBalance, amount);
  const previewIsNegative =
    preview !== null &&
    (function () {
      try {
        return BigInt(fromBalance ?? "0") - toPaise(amount) < 0n;
      } catch {
        return false;
      }
    })();

  const toOptions = activeUsers.filter((u) => u.id !== fromUserId);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="amountPaise" value={amountPaiseStr} />
      <input type="hidden" name="fromUserId" value={fromUserId} />

      {state && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* From — locked for employees */}
      <div className="space-y-1.5">
        <Label>From</Label>
        {isOwner ? (
          <Select value={fromUserId} onValueChange={(v) => { setFromUserId(v); setToUserId(""); }}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.id === currentUserId ? `${u.name} (me)` : u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            {activeUsers.find((u) => u.id === currentUserId)?.name ?? "Me"}
          </div>
        )}
        {fromBalance !== undefined && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Balance: {formatINR(BigInt(fromBalance))}
          </p>
        )}
      </div>

      {/* To */}
      <div className="space-y-1.5">
        <Label>To</Label>
        <Select value={toUserId} onValueChange={setToUserId}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select recipient" />
          </SelectTrigger>
          <SelectContent>
            {toOptions.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="toUserId" value={toUserId} />
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label className="text-base font-semibold">Amount</Label>
        <MoneyInput
          name="_amount_display"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
        />
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-reason">Reason (optional)</Label>
        <Textarea
          id="tx-reason"
          name="reason"
          placeholder="e.g. Site advance, petty cash"
          rows={2}
          maxLength={200}
          className="resize-none"
        />
      </div>

      {/* Wallet preview */}
      {preview !== null && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            previewIsNegative
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Wallet after send:{" "}
          <span className="font-semibold tabular-nums">{preview}</span>
          {previewIsNegative && " — insufficient balance"}
        </div>
      )}

      <div className="sticky bottom-4 pt-2">
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={isPending || !toUserId || !amountPaiseStr}
        >
          {isPending ? "Sending…" : "Send Money"}
        </Button>
      </div>
    </form>
  );
}
