"use client";

import { useTransition } from "react";
import { impersonateCompany } from "@/app/actions/super";

export function ImpersonateButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      title={`Impersonate ${companyName}`}
      onClick={() =>
        startTransition(async () => {
          await impersonateCompany(companyId);
        })
      }
      className="rounded px-2.5 py-1 text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Impersonate"}
    </button>
  );
}
