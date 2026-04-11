"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/app/actions/demo";

export function ResetDemoButton() {
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirmed) {
    return (
      <Button
        variant="destructive"
        className="w-full gap-2"
        onClick={() => setConfirmed(true)}
      >
        <AlertTriangle className="h-4 w-4" />
        Reset Demo Data
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
        Are you sure? All data will be erased. This cannot be undone.
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setConfirmed(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          disabled={isPending}
          onClick={() => startTransition(() => resetDemo())}
        >
          {isPending ? "Resetting…" : "Yes, Reset"}
        </Button>
      </div>
    </div>
  );
}
