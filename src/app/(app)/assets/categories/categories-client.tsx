"use client";

import { useState, useActionState, useTransition, useEffect } from "react";
import { Pencil, Trash2, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { toast } from "sonner";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/asset-categories";
import type { CategoryActionResult } from "@/app/actions/asset-categories";

interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  _count: { assets: number };
}

function CategoryForm({
  existing,
  close,
}: {
  existing?: Category;
  close: () => void;
}) {
  const action = existing ? updateCategory : createCategory;
  const [state, formAction] = useActionState<CategoryActionResult | null, FormData>(action, null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      toast.success(existing ? "Category updated" : "Category created");
      close();
    }
  }, [state, existing, close]);

  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="space-y-4 mt-2">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Name *</label>
        <input
          name="name"
          defaultValue={existing?.name}
          required
          minLength={2}
          maxLength={50}
          placeholder="e.g. Excavators"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      {state && !state.success && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={close}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Saving…" : existing ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.success) toast.success("Category deleted");
      else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <FormDialog
          trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Add Category</Button>}
          title="New Category"
        >
          {({ close }) => <CategoryForm close={close} />}
        </FormDialog>
      </div>

      <div className="rounded-lg border divide-y">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-sm">{cat.name}</span>
              {cat.isDefault && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <ShieldCheck className="h-3 w-3" />Default
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{cat._count.assets} asset{cat._count.assets !== 1 ? "s" : ""}</span>
              {!cat.isDefault && (
                <>
                  <FormDialog
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit {cat.name}</span>
                      </Button>
                    }
                    title="Edit Category"
                  >
                    {({ close }) => <CategoryForm existing={cat} close={close} />}
                  </FormDialog>

                  {deleting === cat.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => handleDelete(cat.id)}
                        disabled={isPending}
                      >
                        {isPending ? "Deleting…" : "Confirm"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDeleting(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(cat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete {cat.name}</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
