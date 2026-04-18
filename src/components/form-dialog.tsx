"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FormDialogProps {
  trigger: ReactNode;
  title: string;
  children: (props: { close: () => void }) => ReactNode;
}

/**
 * Reusable dialog wrapper with a render-prop child pattern.
 * The child receives `close()` to close the dialog on success.
 * Outside-click is disabled so accidental taps don't lose form data.
 */
export function FormDialog({ trigger, title, children }: FormDialogProps) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children({ close })}
      </DialogContent>
    </Dialog>
  );
}
