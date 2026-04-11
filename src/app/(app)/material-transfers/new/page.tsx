import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvailableMaterial } from "@/lib/material";
import { MaterialTransferForm } from "@/components/material-transfers/material-transfer-form";
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

  const sp = await searchParams;

  const sites = await db.site.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Default source: use query param or first active site or central store
  const defaultSourceId =
    sp.from ?? sites[0]?.id ?? "CENTRAL_STORE";

  const resolvedSourceId =
    defaultSourceId === "CENTRAL_STORE" ? null : defaultSourceId;

  const initialMaterial = await getAvailableMaterial(resolvedSourceId);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Transfer Material</h1>
      <p className="text-sm text-muted-foreground">
        Move material between sites or from the central store to a site.
        Cost is transferred proportionally.
      </p>
      <MaterialTransferForm
        sites={sites}
        initialSourceId={defaultSourceId}
        initialMaterial={initialMaterial}
      />
    </div>
  );
}
