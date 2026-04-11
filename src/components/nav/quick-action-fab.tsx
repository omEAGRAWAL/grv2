"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Receipt, ArrowRightLeft, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function QuickActionFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB — sits above the bottom tab bar */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 md:hidden h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Quick actions"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Quick Actions</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-3">
            <Button
              asChild
              size="lg"
              className="h-20 flex-col gap-2 text-base"
              onClick={() => setOpen(false)}
            >
              <Link href="/expense/new">
                <Receipt className="h-6 w-6" />
                Log Expense
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-20 flex-col gap-2 text-base"
              onClick={() => setOpen(false)}
            >
              <Link href="/transfer/new">
                <ArrowRightLeft className="h-6 w-6" />
                Send Money
              </Link>
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full mt-3 text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
