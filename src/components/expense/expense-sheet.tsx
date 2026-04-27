"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ExpenseForm } from "./expense-form";
import { getExpenseFormData } from "@/app/actions/form-data";

type FormData = Awaited<ReturnType<typeof getExpenseFormData>>;

export function ExpenseSheet({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !data) {
      setLoading(true);
      try {
        const result = await getExpenseFormData();
        setData(result);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-2xl flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b shrink-0">
          <SheetTitle>Log Expense</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && data && data.sites.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center mt-4">
              <p className="text-sm font-medium">No active sites</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ask the owner to create a site first.
              </p>
            </div>
          )}
          {!loading && data && data.sites.length > 0 && (
            <ExpenseForm
              sites={data.sites}
              defaultSiteId={data.defaultSiteId}
              actorUsers={data.actorUsers}
              currentUserId={data.currentUserId}
              walletBalances={data.walletBalances}
              isOwner={data.isOwner}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
