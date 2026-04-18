import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CheckInClient } from "./check-in-client";

export default async function CheckInPage() {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login");
  }

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) redirect("/dashboard");

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [existing, assignments] = await Promise.all([
    db.attendance.findUnique({
      where: {
        companyId_userId_date: { companyId, userId: user.id, date: todayDate },
      },
      select: { status: true, method: true, photoUrl: true, createdAt: true },
    }),
    db.siteAssignment.findMany({
      where: { userId: user.id },
      select: { site: { select: { id: true, name: true } } },
    }),
  ]);

  const assignedSites = assignments.map((a) => a.site);

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Check In</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
      <CheckInClient
        assignedSites={assignedSites}
        existing={existing}
      />
    </div>
  );
}
