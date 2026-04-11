import { db } from "@/lib/db";
import type { SiteStatus } from "@prisma/client";

const VALID_STATUSES: SiteStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD"];

export async function getSites(status?: string) {
  const validStatus =
    status && VALID_STATUSES.includes(status as SiteStatus)
      ? (status as SiteStatus)
      : undefined;

  return db.site.findMany({
    where: validStatus ? { status: validStatus } : {},
    orderBy: { createdAt: "desc" },
  });
}
