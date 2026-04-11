"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IncomeForm } from "./income-form";

type SiteOption = { id: string; name: string };

type Props = {
  sites: SiteOption[];
  defaultSiteId?: string;
  trigger?: React.ReactNode;
};

export function AddIncomeDialog({ sites, defaultSiteId, trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Add Income
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Income</DialogTitle>
        </DialogHeader>
        <IncomeForm
          sites={sites}
          defaultSiteId={defaultSiteId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
