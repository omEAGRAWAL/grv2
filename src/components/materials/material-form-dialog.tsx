"use client";

import { useActionState } from "react";
import { createMaterial, updateMaterial } from "@/app/actions/materials";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";

type ActionResult = { success: false; error: string } | { success: true };
type Material = { id: string; name: string; unit: string };

// ─── Create Dialog ────────────────────────────────────────────────────────────

export function CreateMaterialDialog() {
  return (
    <FormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Material
        </Button>
      }
      title="Add Material"
    >
      {({ close }) => <MaterialForm onSuccess={close} />}
    </FormDialog>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

export function EditMaterialDialog({ material }: { material: Material }) {
  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="ghost" className="h-7 px-2">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      }
      title="Edit Material"
    >
      {({ close }) => <MaterialForm material={material} onSuccess={close} />}
    </FormDialog>
  );
}

// ─── Shared Form ──────────────────────────────────────────────────────────────

function MaterialForm({
  material,
  onSuccess,
}: {
  material?: Material;
  onSuccess: () => void;
}) {
  const boundAction = material
    ? updateMaterial.bind(null, material.id)
    : createMaterial;

  async function action(prev: ActionResult | null, formData: FormData) {
    const result = await boundAction(prev, formData);
    if (result.success) onSuccess();
    return result;
  }

  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );
  const error = state && !state.success ? state.error : null;

  return (
    <form action={formAction} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="mat-name">Material Name *</Label>
        <Input
          id="mat-name"
          name="name"
          defaultValue={material?.name}
          placeholder="e.g. Cement"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mat-unit">Default Unit *</Label>
        <Input
          id="mat-unit"
          name="unit"
          defaultValue={material?.unit}
          placeholder="e.g. bag, kg, nos, cft"
          required
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : material ? "Save Changes" : "Add Material"}
      </Button>
    </form>
  );
}
