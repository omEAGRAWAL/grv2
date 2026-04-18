import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HistoryClient } from "./history-client";

export default async function AttendanceHistoryPage() {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login");
  }

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) redirect("/dashboard");

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const records = await db.attendance.findMany({
    where: { companyId, userId: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, status: true, method: true },
  });

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/attendance" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">Attendance History</h1>
      </div>
      <HistoryClient
        userId={user.id}
        userName={user.name}
        initialYear={year}
        initialMonth={month}
        records={records}
      />
    </div>
  );
}
