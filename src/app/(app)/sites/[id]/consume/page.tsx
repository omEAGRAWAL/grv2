import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvailableMaterialV2 } from "@/lib/site-materials";
import { ConsumeClient } from "./consume-client";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, select: { name: true } });
  return { title: site ? `Log Consumption — ${site.name}` : "Log Consumption" };
}

export default async function ConsumePage({ params }: Props) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const site = await db.site.findUnique({ where: { id }, select: { id: true, name: true, companyId: true } });
  if (!site) notFound();

  // Only allow users in the same company
  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (site.companyId !== companyId) notFound();

  // Permission: OWNER / SITE_MANAGER always; SUPERVISOR only if assigned
  const isOwner = currentUser.role === "OWNER";
  const isSiteManager = currentUser.role === "SITE_MANAGER";
  let canConsume = isOwner || isSiteManager;

  if (!canConsume && currentUser.role === "SUPERVISOR") {
    const assignment = await db.siteAssignment.findFirst({
      where: { siteId: id, userId: currentUser.id },
    });
    canConsume = !!assignment;
  }

  const available = await getAvailableMaterialV2(id);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <Link
        href={`/sites/${id}?tab=material`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {site.name}
      </Link>

      <h1 className="text-xl font-semibold">Log Material Consumption</h1>

      <ConsumeClient siteId={id} initialAvailable={available} canConsume={canConsume} />
    </div>
  );
}
