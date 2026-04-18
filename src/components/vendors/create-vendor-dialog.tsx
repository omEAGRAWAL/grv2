"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { VendorForm } from "./vendor-form";

type Props = {
  onCreated?: (vendorId: string, vendorName: string) => void;
  trigger?: React.ReactNode;
};

export function CreateVendorDialog({ onCreated, trigger }: Props) {
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Vendor
          </Button>
        )
      }
      title="New Vendor"
    >
      {({ close }) => (
        <VendorForm
          onSuccess={(vendorId, vendorName) => {
            toast.success("Vendor created");
            close();
            onCreated?.(vendorId, vendorName);
          }}
          onCancel={close}
        />
      )}
    </FormDialog>
  );
}
