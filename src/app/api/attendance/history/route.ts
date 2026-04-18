import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year") ?? new Date().getFullYear());
  const month = Number(sp.get("month") ?? new Date().getMonth() + 1);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const records = await db.attendance.findMany({
    where: { companyId, userId: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, status: true, method: true },
  });

  return NextResponse.json({ records });
}
