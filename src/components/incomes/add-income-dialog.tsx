"use client";

import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { IncomeForm } from "./income-form";

type SiteOption = { id: string; name: string };

type Props = {
  sites: SiteOption[];
  defaultSiteId?: string;
  trigger?: React.ReactNode;
};

export function AddIncomeDialog({ sites, defaultSiteId, trigger }: Props) {
  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Add Income
          </Button>
        )
      }
      title="Record Income"
    >
      {({ close }) => (
        <IncomeForm
          sites={sites}
          defaultSiteId={defaultSiteId}
          onSuccess={() => {
            toast.success("Income recorded");
            close();
          }}
          onCancel={close}
        />
      )}
    </FormDialog>
  );
}
