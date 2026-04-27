"use client";

import { useActionState, useEffect, useState } from "react";
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
import { CategoryPicker, type ExpenseCategory } from "./category-picker";
import { BillPhotoUpload } from "./bill-photo-upload";
import { toPaise, formatINR } from "@/lib/money";
import { createExpense } from "@/app/actions/expenses";

type ActionResult = { success: false; error: string } | { success: true; redirectTo: string };

type Site = { id: string; name: string };
type User = { id: string; name: string };

type Props = {
  sites: Site[];
  defaultSiteId?: string;
  actorUsers: User[]; // for owner "on behalf of" — empty for employees
  currentUserId: string;
  walletBalances: Record<string, string>; // userId → paise as string
  isOwner: boolean;
  onSuccess?: (redirectTo: string) => void;
};

function computePreview(
  balancePaise: string | undefined,
  amountStr: string
): string | null {
  if (!balancePaise) return null;
  const trimmed = amountStr.trim();
  if (!trimmed) return null;
  try {
    const spent = toPaise(trimmed);
    if (spent <= 0n) return null;
    const remaining = BigInt(balancePaise) - spent;
    return formatINR(remaining);
  } catch {
    return null;
  }
}

export function ExpenseForm({
  sites,
  defaultSiteId,
  actorUsers,
  currentUserId,
  walletBalances,
  isOwner,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState("");
  const [siteId, setSiteId] = useState(defaultSiteId ?? (sites[0]?.id ?? ""));
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [onBehalfOf, setOnBehalfOf] = useState<string>(currentUserId);
  const [billPhoto, setBillPhoto] = useState<{
    secure_url: string;
    public_id: string;
  } | null>(null);

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createExpense,
    null
  );

  useEffect(() => {
    if (state && state.success && onSuccess) {
      onSuccess(state.redirectTo);
    }
  }, [state, onSuccess]);

  // Convert human amount to paise string for the hidden field
  let amountPaiseStr = "";
  try {
    if (amount.trim()) {
      amountPaiseStr = toPaise(amount).toString();
    }
  } catch {
    /* invalid — will be caught by server action */
  }

  const actorBalance = walletBalances[onBehalfOf];
  const preview = computePreview(actorBalance, amount);
  const previewIsNegative =
    preview !== null &&
    (function () {
      try {
        const spent = toPaise(amount);
        return BigInt(actorBalance ?? "0") - spent < 0n;
      } catch {
        return false;
      }
    })();

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden fields */}
      <input type="hidden" name="amountPaise" value={amountPaiseStr} />
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="category" value={category ?? ""} />
      {onBehalfOf !== currentUserId && (
        <input type="hidden" name="onBehalfOfUserId" value={onBehalfOf} />
      )}

      {state && !state.success && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Amount — big touch target, autofocus */}
      <div className="space-y-1.5">
        <Label className="text-base font-semibold">Amount</Label>
        <MoneyInput
          name="_amount_display"
          value={amount}
          onChange={setAmount}
          placeholder="0.00"
        />
      </div>

      {/* Site */}
      <div className="space-y-1.5">
        <Label>Site</Label>
        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category grid */}
      <CategoryPicker value={category} onChange={setCategory} />

      {/* Bill photo */}
      <BillPhotoUpload value={billPhoto} onChange={setBillPhoto} />
      {billPhoto && (
        <>
          <input type="hidden" name="billPhotoUrl" value={billPhoto.secure_url} />
          <input type="hidden" name="billPhotoPublicId" value={billPhoto.public_id} />
        </>
      )}

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="exp-note">Note (optional)</Label>
        <Textarea
          id="exp-note"
          name="note"
          placeholder="What was this for?"
          rows={2}
          maxLength={200}
          className="resize-none"
        />
      </div>

      {/* On behalf of — owner only */}
      {isOwner && actorUsers.length > 0 && (
        <div className="space-y-1.5">
          <Label>On behalf of</Label>
          <Select value={onBehalfOf} onValueChange={setOnBehalfOf}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={currentUserId}>Myself</SelectItem>
              {actorUsers
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Wallet preview */}
      {preview !== null && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            previewIsNegative
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          Wallet after:{" "}
          <span className="font-semibold tabular-nums">{preview}</span>
          {previewIsNegative && " — insufficient balance"}
        </div>
      )}

      {/* Submit — sticky on mobile */}
      <div className="sticky bottom-4 pt-2">
        <Button
          type="submit"
          className="w-full h-12 text-base"
          disabled={isPending || !category || !siteId || !amountPaiseStr}
        >
          {isPending ? "Logging…" : "Log Expense"}
        </Button>
      </div>
    </form>
  );
}
