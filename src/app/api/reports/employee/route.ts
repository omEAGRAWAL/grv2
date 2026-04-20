import { type NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCsv, csvDate, csvDateStamp } from "@/lib/csv";

const HEADERS = [
  "Date",
  "Type",
  "Category",
  "Amount (₹)",
  "Site",
  "Counterparty",
  "Logged By",
  "Note",
  "Voided",
];

export async function GET(req: NextRequest) {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = req.nextUrl.searchParams.get("employeeId");
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }

  const companyId = owner.effectiveCompanyId!;
  const employee = await db.user.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, name: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const txns = await db.walletTransaction.findMany({
    where: { actorUserId: employeeId },
    include: {
      site: { select: { name: true } },
      loggedBy: { select: { name: true } },
      counterparty: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = txns.map((t) => [
    csvDate(t.createdAt),
    t.type,
    t.category ?? "",
    `${t.direction === "DEBIT" ? "-" : ""}${(Number(t.amountPaise) / 100).toFixed(2)}`,
    t.site?.name ?? "",
    t.counterparty?.name ?? "",
    t.loggedBy.name,
    t.note ?? "",
    t.voidedAt ? "Yes" : "No",
  ]);

  const csv = buildCsv(HEADERS, rows);
  const filename = `constructhub_employee_${csvDateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
