import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { CreateMaterialDialog } from "@/components/materials/material-form-dialog";
import { EditMaterialDialog } from "@/components/materials/material-form-dialog";
import { DeleteMaterialButton } from "@/components/materials/delete-material-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Materials — ConstructHub" };

export default async function MaterialsPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER" && currentUser.role !== "SITE_MANAGER") {
    redirect("/dashboard");
  }

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const materials = await db.material.findMany({
    where: { companyId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const canEdit = currentUser.role === "OWNER" || currentUser.role === "SITE_MANAGER";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Material Master List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {materials.length} material{materials.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && <CreateMaterialDialog />}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Default</th>
              {canEdit && <th className="px-3 py-2 w-20"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {materials.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{m.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{m.unit}</td>
                <td className="px-3 py-2 text-center">
                  {m.isDefault && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    {!m.isDefault && (
                      <div className="flex items-center gap-1 justify-end">
                        <EditMaterialDialog material={m} />
                        <DeleteMaterialButton id={m.id} name={m.name} />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
