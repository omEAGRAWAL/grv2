import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BulkAttendanceForm } from "./bulk-attendance-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bulk Attendance — ConstructHub" };

export default async function BulkAttendancePage() {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) redirect("/login");

  if (currentUser.role !== "OWNER" && currentUser.role !== "SITE_MANAGER") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6">
        <p className="font-semibold">Access Denied</p>
        <p className="text-sm text-muted-foreground">
          Only owners and site managers can mark bulk attendance.
        </p>
      </div>
    );
  }

  const companyId = currentUser.effectiveCompanyId ?? currentUser.companyId;
  if (!companyId) redirect("/login");

  const employees = await db.user.findMany({
    where: {
      companyId,
      isActive: true,
      role: { notIn: ["OWNER", "SUPERADMIN"] },
    },
    select: { id: true, name: true, title: true, role: true },
    orderBy: { name: "asc" },
  });

  const sites = await db.site.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Bulk Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mark attendance for multiple employees at once.
        </p>
      </div>

      <BulkAttendanceForm employees={employees} sites={sites} />
    </div>
  );
}
