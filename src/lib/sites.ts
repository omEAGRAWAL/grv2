import { getUnscopedDb } from "@/lib/db";
import type { SiteStatus } from "@prisma/client";

// Scoped by companyId (optional) or userId assignments. Callers verify ownership.
const db = getUnscopedDb();

const VALID_STATUSES: SiteStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD"];

interface GetSitesOptions {
  status?: string;
  userId?: string;
  role?: string;
  companyId?: string;
}

export async function getSites({ status, userId, role, companyId }: GetSitesOptions = {}) {
  const validStatus =
    status && VALID_STATUSES.includes(status as SiteStatus)
      ? (status as SiteStatus)
      : undefined;

  // SUPERVISORs only see their assigned sites
  if (role === "SUPERVISOR" && userId) {
    const assignments = await db.siteAssignment.findMany({
      where: { userId },
      select: { siteId: true },
    });
    const assignedIds = assignments.map((a) => a.siteId);

    return db.site.findMany({
      where: {
        id: { in: assignedIds },
        ...(companyId ? { companyId } : {}),
        ...(validStatus ? { status: validStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return db.site.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      ...(validStatus ? { status: validStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}
