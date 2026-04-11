"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetPassword } from "@/app/actions/employees";

type Props = {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(resetPassword, null);

  useEffect(() => {
    if (state?.success) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set a new password for <strong>{userName}</strong>.
        </p>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          {state && !state.success && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {state.error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              required
              disabled={isPending}
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Resetting…" : "Reset Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
