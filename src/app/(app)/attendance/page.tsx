import { redirect } from "next/navigation";
import Link from "next/link";
import { Camera } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AttendanceTable } from "./attendance-table";

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
};

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-800",
  HALF_DAY: "bg-yellow-100 text-yellow-800",
  ABSENT: "bg-red-100 text-red-800",
};

export default async function AttendancePage() {
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
  const sevenDaysAgo = new Date(todayDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const canManage = user.role === "OWNER" || user.role === "SITE_MANAGER";

  // For managers: fetch roll-call + own today record
  // For others: fetch own today + 7-day history
  const [myToday, recentHistory, rollCall] = await Promise.all([
    db.attendance.findUnique({
      where: { companyId_userId_date: { companyId, userId: user.id, date: todayDate } },
      select: { status: true, method: true, photoUrl: true },
    }),
    db.attendance.findMany({
      where: { companyId, userId: user.id, date: { gte: sevenDaysAgo, lte: todayDate } },
      orderBy: { date: "desc" },
      select: { date: true, status: true, method: true },
    }),
    canManage
      ? (async () => {
          const [employees, records] = await Promise.all([
            db.user.findMany({
              where: { companyId, isActive: true, role: { notIn: ["OWNER", "SUPERADMIN"] } },
              select: { id: true, name: true, role: true, title: true },
              orderBy: { name: "asc" },
            }),
            db.attendance.findMany({
              where: { companyId, date: todayDate },
              select: { userId: true, status: true, method: true, photoUrl: true },
            }),
          ]);
          const recordMap = new Map(records.map((r) => [r.userId, r]));
          return employees.map((emp) => ({
            ...emp,
            attendance: recordMap.get(emp.id) ?? null,
          }));
        })()
      : Promise.resolve(null),
  ]);

  const presentCount = rollCall?.filter((r) => r.attendance?.status === "PRESENT").length ?? 0;
  const totalCount = rollCall?.length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/attendance/history">History</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/attendance/check-in">
              <Camera className="mr-1.5 h-4 w-4" /> Check In
            </Link>
          </Button>
        </div>
      </div>

      {/* My status */}
      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">My Status Today</p>
        {myToday ? (
          <div className="flex items-center gap-3">
            <span
              className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[myToday.status] ?? ""}`}
            >
              {STATUS_LABELS[myToday.status] ?? myToday.status}
            </span>
            {myToday.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={myToday.photoUrl}
                alt="selfie"
                className="h-10 w-10 rounded-full object-cover border"
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Not checked in</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/attendance/check-in">
                <Camera className="mr-1 h-3.5 w-3.5" /> Check In Now
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* 7-day history for self */}
      {recentHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Last 7 Days</p>
          <div className="flex gap-2 flex-wrap">
            {recentHistory.map((r) => (
              <div key={r.date.toISOString()} className="flex flex-col items-center gap-1">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}
                >
                  {r.status === "PRESENT" ? "P" : r.status === "HALF_DAY" ? "H" : "A"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {r.date.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manager roll-call */}
      {canManage && rollCall && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Today&apos;s Roll Call
            </p>
            <span className="text-sm text-muted-foreground">
              {presentCount} / {totalCount} present
            </span>
          </div>
          <AttendanceTable rows={rollCall} canMark={canManage} />
        </div>
      )}
    </div>
  );
}
