import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvailableMaterial } from "@/lib/material";
import { MaterialTransferForm } from "@/components/material-transfers/material-transfer-form";
import { MaterialTransferDialogLayout } from "@/components/material-transfers/material-transfer-dialog-layout";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transfer Material — ConstructHub" };

export default async function MaterialTransferNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const sp = await searchParams;

  const sites = await db.site.findMany({
    where: { status: "ACTIVE", companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultSourceId = sp.from ?? sites[0]?.id ?? "CENTRAL_STORE";
  const resolvedSourceId = defaultSourceId === "CENTRAL_STORE" ? null : defaultSourceId;
  const initialMaterial = await getAvailableMaterial(resolvedSourceId, companyId);

  return (
    <MaterialTransferDialogLayout>
      <MaterialTransferForm
        sites={sites}
        initialSourceId={defaultSourceId}
        initialMaterial={initialMaterial}
      />
    </MaterialTransferDialogLayout>
  );
}
