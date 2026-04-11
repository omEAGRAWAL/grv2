"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createEmployee } from "@/app/actions/employees";

export function AddEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createEmployee, null);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4 pt-2">
          {state && !state.success && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name</Label>
            <Input
              id="add-name"
              name="name"
              required
              disabled={isPending}
              placeholder="Ravi Kumar"
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
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, underscores only (3–30 chars)
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-password">Initial Password</Label>
            <Input
              id="add-password"
              name="password"
              type="password"
              required
              disabled={isPending}
              minLength={8}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
