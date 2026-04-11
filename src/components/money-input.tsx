"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toPaise } from "@/lib/money";
import { formatINR } from "@/lib/money";

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
};

function getPreview(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const paise = toPaise(trimmed);
    if (paise < 0n) return null;
    return formatINR(paise);
  } catch {
    return null;
  }
}

export function MoneyInput({
  name,
  value,
  onChange,
  label,
  error,
  placeholder,
}: Props) {
  const id = useId();
  const preview = getPreview(value);

  return (
    <div className="space-y-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder ?? "0.00"}
        className={error ? "border-destructive" : ""}
        autoComplete="off"
      />
      {preview && (
        <p className="text-xs text-muted-foreground tabular-nums">{preview}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
