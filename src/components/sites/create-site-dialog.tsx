"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/money-input";
import { FormDialog } from "@/components/form-dialog";
import { createSite } from "@/app/actions/sites";

type ActionResult = { success: true } | { success: false; error: string };

function CreateSiteForm({ close }: { close: () => void }) {
  const [contractValue, setContractValue] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createSite,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Site created");
      close();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={formAction} className="space-y-4 mt-2">
      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cs-name">Site Name</Label>
        <Input id="cs-name" name="name" placeholder="Project Alpha" required disabled={isPending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cs-location">Location</Label>
        <Input id="cs-location" name="location" placeholder="Mumbai, Maharashtra" required disabled={isPending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cs-client">Client Name</Label>
        <Input id="cs-client" name="clientName" placeholder="ACME Corp" required disabled={isPending} />
      </div>

      <MoneyInput
        name="contractValue"
        value={contractValue}
        onChange={setContractValue}
        label="Contract Value (₹)"
        placeholder="50,00,000"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cs-start">Start Date</Label>
          <Input id="cs-start" name="startDate" type="date" required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs-end">Expected End Date</Label>
          <Input id="cs-end" name="expectedEndDate" type="date" disabled={isPending} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <input type="hidden" name="status" value={status} />
        <Select value={status} onValueChange={setStatus} disabled={isPending}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ON_HOLD">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" size="sm" onClick={close} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create Site"}
        </Button>
      </div>
    </form>
  );
}

export function CreateSiteDialog() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Site
        </Button>
      }
      title="Create New Site"
    >
      {({ close }) => <CreateSiteForm close={close} />}
    </FormDialog>
  );
}
