"use client";

import { Hammer, Users, Truck, UtensilsCrossed, Package, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpenseCategory =
  | "MATERIALS"
  | "LABOR"
  | "TRANSPORT"
  | "FOOD"
  | "MISC"
  | "OTHER";

const CATEGORIES: {
  value: ExpenseCategory;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { value: "MATERIALS", label: "Materials", Icon: Hammer },
  { value: "LABOR",     label: "Labor",     Icon: Users },
  { value: "TRANSPORT", label: "Transport", Icon: Truck },
  { value: "FOOD",      label: "Food",      Icon: UtensilsCrossed },
  { value: "MISC",      label: "Misc",      Icon: Package },
  { value: "OTHER",     label: "Other",     Icon: MoreHorizontal },
];

type Props = {
  value: ExpenseCategory | null;
  onChange: (v: ExpenseCategory) => void;
};

export function CategoryPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Category</p>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map(({ value: cat, label, Icon }) => {
          const selected = value === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(cat)}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-all active:scale-95",
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
