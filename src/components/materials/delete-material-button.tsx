"use client";

import { useState } from "react";
import { deleteMaterial } from "@/app/actions/materials";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteMaterialButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);

  async function handle() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setPending(true);
    const result = await deleteMaterial(id);
    if (!result.success) {
      toast.error(result.error);
    } else {
      toast.success("Material deleted");
    }
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-destructive hover:text-destructive"
      onClick={handle}
      disabled={pending}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
