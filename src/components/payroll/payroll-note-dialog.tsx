"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { addPayrollNote } from "@/app/actions/payroll";

type ActionResult = { success: true } | { success: false; error: string };

type Props = {
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PayrollNoteDialog({ userId, open, onOpenChange }: Props) {
  const [noteDate, setNoteDate] = useState(todayISO());
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    addPayrollNote,
    null
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Note added");
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  useEffect(() => {
    if (open) setNoteDate(todayISO());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Payroll Note</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 mt-2">
          {state && !state.success && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <input type="hidden" name="userId" value={userId} />

          <div className="space-y-1.5">
            <Label htmlFor="note-text">Note</Label>
            <Textarea
              id="note-text"
              name="note"
              placeholder="e.g. Diwali bonus included"
              rows={3}
              className="resize-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-date">Date</Label>
            <Input
              id="note-date"
              name="noteDate"
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              <StickyNote className="h-4 w-4 mr-1.5" />
              {isPending ? "Saving…" : "Add Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
