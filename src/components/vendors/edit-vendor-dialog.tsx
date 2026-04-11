"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
        </DialogHeader>
        <VendorForm vendor={vendor} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
