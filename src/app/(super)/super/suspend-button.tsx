"use client";

import { useTransition } from "react";
import { toggleCompanyStatus } from "@/app/actions/super";

export function SuspendButton({
  companyId,
  currentStatus,
}: {
  companyId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isSuspended = currentStatus === "SUSPENDED";

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleCompanyStatus(companyId, currentStatus);
        })
      }
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isSuspended
          ? "bg-green-900/40 text-green-400 hover:bg-green-900/70"
          : "bg-red-900/40 text-red-400 hover:bg-red-900/70"
      }`}
    >
      {isPending ? "…" : isSuspended ? "Activate" : "Suspend"}
    </button>
  );
}
