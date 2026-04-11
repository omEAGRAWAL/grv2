"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VendorForm } from "./vendor-form";

type Props = {
  /** Called after a vendor is created — allows the parent to add it to a list */
  onCreated?: (vendorId: string, vendorName: string) => void;
  /** Custom trigger element — defaults to a "+ Add Vendor" button */
  trigger?: React.ReactNode;
};

export function CreateVendorDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = useState(false);

  function handleSuccess(vendorId: string, vendorName: string) {
    setOpen(false);
    onCreated?.(vendorId, vendorName);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Vendor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Vendor</DialogTitle>
        </DialogHeader>
        <VendorForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
