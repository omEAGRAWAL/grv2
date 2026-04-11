"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Props = {
  basePath: string;
  currentType?: string;
  currentFrom?: string;
  currentTo?: string;
};

const TX_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "TOPUP", label: "Top Up" },
  { value: "EXPENSE", label: "Expense" },
  { value: "TRANSFER_OUT", label: "Transfer Out" },
  { value: "TRANSFER_IN", label: "Transfer In" },
  { value: "VENDOR_PAYMENT", label: "Vendor Payment" },
  { value: "REVERSAL", label: "Reversal" },
];

export function WalletFilters({ basePath, currentType, currentFrom, currentTo }: Props) {
  const router = useRouter();

  function buildUrl(overrides: {
    type?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();
    const type = overrides.type ?? currentType;
    const from = overrides.from ?? currentFrom;
    const to = overrides.to ?? currentTo;
    if (type && type !== "ALL") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    // Reset to page 1 on filter change
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  function clearFilters() {
    router.push(basePath);
  }

  const hasFilters =
    (currentType && currentType !== "ALL") || currentFrom || currentTo;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Type</Label>
        <Select
          value={currentType ?? "ALL"}
          onValueChange={(v) => router.push(buildUrl({ type: v }))}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TX_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={currentFrom ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ from: e.target.value || undefined }))
          }
          className="h-8 w-36 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={currentTo ?? ""}
          onChange={(e) =>
            router.push(buildUrl({ to: e.target.value || undefined }))
          }
          className="h-8 w-36 text-xs"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={clearFilters}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
