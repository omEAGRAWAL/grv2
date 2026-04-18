"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toggleEmployeeActive } from "@/app/actions/employees";

type Props = {
  userId: string;
  userName: string;
  isActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeactivateDialog({
  userId,
  userName,
  isActive,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    toggleEmployeeActive,
    null
  );

  const action = isActive ? "Deactivate" : "Reactivate";

  useEffect(() => {
    if (state?.success) {
      toast.success(`Employee ${action.toLowerCase()}d`);
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router, action]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{action} Employee</DialogTitle>
        </DialogHeader>
        {isActive ? (
          <p className="text-sm text-muted-foreground">
            <strong>{userName}</strong> will not be able to log in after
            deactivation. You can reactivate them at any time.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <strong>{userName}</strong> will be able to log in again.
          </p>
        )}
        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="active" value={isActive ? "false" : "true"} />
          {state && !state.success && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2 mb-3">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isActive ? "destructive" : "default"}
              disabled={isPending}
            >
              {isPending ? `${action}ing…` : action}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
