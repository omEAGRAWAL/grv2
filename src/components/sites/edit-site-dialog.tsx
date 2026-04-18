"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
import { updateSite } from "@/app/actions/sites";

type ActionResult = { success: true } | { success: false; error: string };

export type SerializedSite = {
  id: string;
  name: string;
  location: string;
  clientName: string;
  contractValueRupees: string;
  startDate: string;
  expectedEndDate: string;
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD";
};

function EditSiteForm({ site, close }: { site: SerializedSite; close: () => void }) {
  const [contractValue, setContractValue] = useState(site.contractValueRupees);
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED" | "ON_HOLD">(site.status);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateSite,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Site updated");
      close();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={formAction} className="space-y-4 mt-2">
      {state && !state.success && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <input type="hidden" name="siteId" value={site.id} />

      <div className="space-y-1.5">
        <Label htmlFor="es-name">Site Name</Label>
        <Input id="es-name" name="name" defaultValue={site.name} required disabled={isPending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="es-location">Location</Label>
        <Input id="es-location" name="location" defaultValue={site.location} required disabled={isPending} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="es-client">Client Name</Label>
        <Input id="es-client" name="clientName" defaultValue={site.clientName} required disabled={isPending} />
      </div>

      <MoneyInput
        name="contractValue"
        value={contractValue}
        onChange={setContractValue}
        label="Contract Value (₹)"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="es-start">Start Date</Label>
          <Input id="es-start" name="startDate" type="date" defaultValue={site.startDate} required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="es-end">Expected End Date</Label>
          <Input id="es-end" name="expectedEndDate" type="date" defaultValue={site.expectedEndDate} disabled={isPending} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <input type="hidden" name="status" value={status} />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)} disabled={isPending}>
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
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

export function EditSiteButton({ site }: { site: SerializedSite }) {
  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
      }
      title="Edit Site"
    >
      {({ close }) => <EditSiteForm site={site} close={close} />}
    </FormDialog>
  );
}
