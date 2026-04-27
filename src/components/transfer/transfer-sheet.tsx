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
import { TransferForm } from "./transfer-form";
import { getTransferFormData } from "@/app/actions/form-data";

type FormData = Awaited<ReturnType<typeof getTransferFormData>>;

export function TransferSheet({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen && !data) {
      setLoading(true);
      try {
        const result = await getTransferFormData();
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
        className="h-[80vh] rounded-t-2xl flex flex-col p-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b shrink-0">
          <SheetTitle>Send Money</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && data && (
            <TransferForm
              activeUsers={data.activeUsers}
              currentUserId={data.currentUserId}
              isOwner={data.isOwner}
              walletBalances={data.walletBalances}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
