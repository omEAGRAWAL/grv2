"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SiteFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(value: string) {
    const params = new URLSearchParams();
    if (value !== "ALL") params.set("status", value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current ?? "ALL"} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All Sites</SelectItem>
        <SelectItem value="ACTIVE">Active</SelectItem>
        <SelectItem value="COMPLETED">Completed</SelectItem>
        <SelectItem value="ON_HOLD">On Hold</SelectItem>
      </SelectContent>
    </Select>
  );
}
