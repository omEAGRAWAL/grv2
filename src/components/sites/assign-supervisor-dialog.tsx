"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialog } from "@/components/form-dialog";
import { assignSupervisor } from "@/app/actions/site-assignments";

interface Candidate {
  id: string;
  name: string;
  role: string;
}

interface Props {
  siteId: string;
  candidates: Candidate[];
}

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR: "Supervisor",
  SITE_MANAGER: "Site Manager",
};

function AssignForm({ siteId, candidates, close }: Props & { close: () => void }) {
  const [userId, setUserId] = useState("");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(assignSupervisor, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Supervisor assigned");
      close();
      router.refresh();
    }
  }, [state, close, router]);

  return (
    <form action={formAction} className="space-y-4 pt-2">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="userId" value={userId} />

      {state && !state.success && (
        <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {state.error}
        </p>
      )}

      <Select value={userId} onValueChange={setUserId} disabled={isPending}>
        <SelectTrigger>
          <SelectValue placeholder="Select a person…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}{" "}
              <span className="text-muted-foreground text-xs">
                ({ROLE_LABELS[c.role] ?? c.role})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !userId}>
          {isPending ? "Assigning…" : "Assign"}
        </Button>
      </div>
    </form>
  );
}

export function AssignSupervisorDialog({ siteId, candidates }: Props) {
  if (candidates.length === 0) return null;

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Assign
        </Button>
      }
      title="Assign Supervisor"
    >
      {({ close }) => (
        <AssignForm siteId={siteId} candidates={candidates} close={close} />
      )}
    </FormDialog>
  );
}
