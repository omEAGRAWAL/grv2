import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchCompanyUpdates } from "@/app/actions/site-updates";
import { UpdatesFeed } from "./updates-feed";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Site Updates — ConstructHub" };

export default async function UpdatesPage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "OWNER") redirect("/dashboard");

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/dashboard");

  const [{ updates, total }, sites] = await Promise.all([
    fetchCompanyUpdates(companyId, 1),
    db.site.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize updates (dates → ISO strings)
  const serialized = updates.map((u) => ({
    id: u.id,
    siteId: u.siteId,
    siteName: (u as typeof u & { site?: { name: string } }).site?.name,
    workDone: u.workDone,
    headcount: u.headcount,
    blockers: u.blockers,
    photos: Array.isArray(u.photos) ? (u.photos as { url: string; publicId: string }[]) : [],
    submittedById: u.submittedById,
    submitterName: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.name,
    submitterTitle: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.title,
    editedAt: u.editedAt ? u.editedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    canEdit: false, // owner feed — editing disabled for simplicity
    canVoid: true,
  }));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Site Updates</h1>
      <UpdatesFeed
        companyId={companyId}
        initialUpdates={serialized}
        totalCount={total}
        currentUserId={currentUser.id}
        sites={sites}
      />
    </div>
  );
}
