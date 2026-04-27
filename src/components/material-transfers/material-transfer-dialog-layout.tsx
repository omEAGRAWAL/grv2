"use client";

import { useRouter } from "next/navigation";
import { X, ArrowLeftRight } from "lucide-react";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function MaterialTransferDialogLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Dialog panel */}
      <div className="relative bg-background w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[90vh] rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold">Transfer Material</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => router.back()}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 pb-8">
          <p className="text-sm text-muted-foreground mb-5">
            Move material between sites or from the central store to a site.
            Cost is transferred proportionally.
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
