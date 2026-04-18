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
import { FormDialog } from "@/components/form-dialog";
import { createEmployee } from "@/app/actions/employees";

const ROLE_OPTIONS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "WORKER", label: "Worker" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "SITE_MANAGER", label: "Site Manager" },
] as const;

function AddEmployeeForm({ close, callerRole }: { close: () => void; callerRole?: string }) {
  const [role, setRole] = useState("EMPLOYEE");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createEmployee, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Employee added");
      close();
      router.refresh();
    }
  }, [state, close, router]);

  const availableRoles =
    callerRole === "SITE_MANAGER"
      ? ROLE_OPTIONS.filter((r) => r.value !== "SITE_MANAGER")
      : ROLE_OPTIONS;

  return (
    <form action={formAction} className="space-y-4 pt-2">
      {state && !state.success && (
        <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="add-name">Full Name</Label>
        <Input id="add-name" name="name" required disabled={isPending} placeholder="Ravi Kumar" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="add-role">Role</Label>
        <input type="hidden" name="role" value={role} />
        <Select value={role} onValueChange={setRole} disabled={isPending}>
          <SelectTrigger id="add-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="add-title">
          Title <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="add-title" name="title" disabled={isPending} placeholder="Mason, Electrician, …" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="add-mobile">
          Mobile <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="add-mobile"
          name="mobileNumber"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          disabled={isPending}
          placeholder="9876543210"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="add-username">Username</Label>
        <Input
          id="add-username"
          name="username"
          required
          disabled={isPending}
          placeholder="ravi_kumar"
          autoCapitalize="none"
          pattern="[a-z0-9_]+"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores (3–30 chars)</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="add-password">Initial Password</Label>
        <Input id="add-password" name="password" type="password" required disabled={isPending} minLength={8} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  callerRole?: string;
}

export function AddEmployeeDialog({ callerRole }: Props) {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Employee
        </Button>
      }
      title="Add Employee"
    >
      {({ close }) => <AddEmployeeForm close={close} callerRole={callerRole} />}
    </FormDialog>
  );
}
