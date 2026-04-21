import { type NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCsv, csvDate, csvDateStamp } from "@/lib/csv";
import type { WalletTxnType } from "@prisma/client";

const HEADERS = ["Payment Date", "Type", "Direction", "Amount (₹)", "Note", "Logged By", "Voided"];

const TYPE_LABELS: Record<string, string> = {
  TOPUP: "Advance",
  SALARY: "Salary",
  ADVANCE_RECOVERY: "Recovery",
};

export async function GET(req: NextRequest) {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const employee = await db.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, name: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const payrollTypes: WalletTxnType[] = ["TOPUP", "SALARY", "ADVANCE_RECOVERY"];
  const txns = await db.walletTransaction.findMany({
    where: { actorUserId: userId, companyId, type: { in: payrollTypes } },
    include: { loggedBy: { select: { name: true } } },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  });

  const rows = txns.map((t) => [
    t.paymentDate ? csvDate(t.paymentDate) : csvDate(t.createdAt),
    TYPE_LABELS[t.type] ?? t.type,
    t.direction,
    `${t.direction === "DEBIT" ? "-" : ""}${(Number(t.amountPaise) / 100).toFixed(2)}`,
    t.note ?? "",
    t.loggedBy.name,
    t.voidedAt ? "Yes" : "No",
  ]);

  const csv = buildCsv(HEADERS, rows);
  const filename = `payroll_${employee.name.replace(/\s+/g, "_")}_${csvDateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
