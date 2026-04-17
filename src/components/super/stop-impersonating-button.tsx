"use client";

import { useTransition } from "react";
import { stopImpersonating } from "@/app/actions/super";

export function StopImpersonatingButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(async () => { await stopImpersonating(); })}
      className="underline underline-offset-2 hover:no-underline disabled:opacity-50"
    >
      {isPending ? "Exiting…" : "Exit"}
    </button>
  );
}
