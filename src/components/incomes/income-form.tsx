"use client";

import { useActionState } from "react";
import { CalendarIcon } from "lucide-react";
import { createSiteIncome } from "@/app/actions/incomes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SiteOption = { id: string; name: string };

type Props = {
  sites: SiteOption[];
  defaultSiteId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type ActionResult = { success: true } | { success: false; error: string };

const INCOME_TYPE_LABELS: Record<string, string> = {
  ADVANCE: "Advance",
  RUNNING_BILL: "Running Bill",
  FINAL: "Final",
  RETENTION: "Retention",
};

export function IncomeForm({ sites, defaultSiteId, onSuccess, onCancel }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await createSiteIncome(prev, formData);
    if (result.success && onSuccess) {
      onSuccess();
    }
    return result;
  }, null);

  const error = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Site */}
      <div className="space-y-1.5">
        <Label htmlFor="if-site">Site *</Label>
        <Select name="siteId" defaultValue={defaultSiteId ?? sites[0]?.id ?? ""}>
          <SelectTrigger id="if-site">
            <SelectValue placeholder="Select site…" />
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

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="if-amount">Amount Received (₹) *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            ₹
          </span>
          <Input
            id="if-amount"
            name="amountRupees"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="5,00,000.00"
            className="pl-7"
            required
          />
        </div>
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="if-date">Date Received *</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="if-date"
            name="receivedDate"
            type="date"
            defaultValue={today}
            className="pl-9"
            required
          />
        </div>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <Label htmlFor="if-type">Payment Type *</Label>
        <Select name="type" defaultValue="ADVANCE">
          <SelectTrigger id="if-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="if-note">Note</Label>
        <Textarea
          id="if-note"
          name="note"
          placeholder="Optional reference or remarks…"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Recording…" : "Record Income"}
        </Button>
      </div>
    </form>
  );
}
