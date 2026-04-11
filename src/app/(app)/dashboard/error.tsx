"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6">
      <p className="text-sm text-muted-foreground">Failed to load dashboard.</p>
      <Button onClick={reset} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  );
}
