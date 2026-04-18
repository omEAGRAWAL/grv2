import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAvailableMaterialV2 } from "@/lib/site-materials";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await params;
  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;

  const site = await db.site.findUnique({ where: { id: siteId }, select: { companyId: true } });
  if (!site || site.companyId !== companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await getAvailableMaterialV2(siteId);
  return NextResponse.json({ items });
}
