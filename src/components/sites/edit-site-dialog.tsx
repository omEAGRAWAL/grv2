"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { updateSite } from "@/app/actions/sites";

type ActionResult = { success: true } | { success: false; error: string };

export type SerializedSite = {
  id: string;
  name: string;
  location: string;
  clientName: string;
  contractValueRupees: string;
  startDate: string;       // "YYYY-MM-DD"
  expectedEndDate: string; // "YYYY-MM-DD" or ""
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD";
};

export function EditSiteButton({ site }: { site: SerializedSite }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1.5" />
        Edit
      </Button>
      <EditSiteDialog site={site} open={open} onOpenChange={setOpen} />
    </>
  );
}

function EditSiteDialog({
  site,
  open,
  onOpenChange,
}: {
  site: SerializedSite;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [contractValue, setContractValue] = useState(site.contractValueRupees);
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED" | "ON_HOLD">(site.status);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateSite,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setContractValue(site.contractValueRupees);
      setStatus(site.status);
    }
  }, [open, site]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 mt-2">
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <input type="hidden" name="siteId" value={site.id} />

          <div className="space-y-1.5">
            <Label htmlFor="es-name">Site Name</Label>
            <Input
              id="es-name"
              name="name"
              defaultValue={site.name}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="es-location">Location</Label>
            <Input
              id="es-location"
              name="location"
              defaultValue={site.location}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="es-client">Client Name</Label>
            <Input
              id="es-client"
              name="clientName"
              defaultValue={site.clientName}
              required
            />
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
              <Input
                id="es-start"
                name="startDate"
                type="date"
                defaultValue={site.startDate}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="es-end">Expected End Date</Label>
              <Input
                id="es-end"
                name="expectedEndDate"
                type="date"
                defaultValue={site.expectedEndDate}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <input type="hidden" name="status" value={status} />
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
