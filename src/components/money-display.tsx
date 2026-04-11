import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  amount: bigint;
  compact?: boolean;
  colorBySign?: boolean;
  className?: string;
};

export function MoneyDisplay({ amount, compact, colorBySign, className }: Props) {
  const formatted = compact ? formatINRCompact(amount) : formatINR(amount);

  const colorClass = colorBySign
    ? amount > 0n
      ? "text-green-600"
      : amount < 0n
        ? "text-red-600"
        : ""
    : "";

  return (
    <span className={cn("tabular-nums", colorClass, className)}>
      {formatted}
    </span>
  );
}
