"use client";

import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { VendorForm } from "./vendor-form";

type VendorData = {
  id: string;
  name: string;
  contactPhone: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
};

export function EditVendorDialog({ vendor }: { vendor: VendorData }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
      }
      title="Edit Vendor"
    >
      {({ close }) => (
        <VendorForm
          vendor={vendor}
          onSuccess={() => {
            toast.success("Vendor updated");
            close();
          }}
          onCancel={close}
        />
      )}
    </FormDialog>
  );
}
