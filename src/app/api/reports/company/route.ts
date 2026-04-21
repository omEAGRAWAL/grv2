import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCsv, csvDate, csvDateStamp } from "@/lib/csv";

const HEADERS = [
  "Date",
  "Type",
  "Category",
  "Item",
  "Qty",
  "Unit",
  "Amount (₹)",
  "Site",
  "Counterparty",
  "Vendor",
  "Actor",
  "Logged By",
  "Note",
  "Voided",
];

export async function GET() {
  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try {
    owner = await requireOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = owner.effectiveCompanyId ?? owner.companyId;
  if (!companyId) return NextResponse.json({ error: "No company context" }, { status: 403 });

  const [walletTxns, purchases, transfersIn, incomes] = await Promise.all([
    db.walletTransaction.findMany({
      where: { companyId },
      include: {
        actor: { select: { name: true } },
        site: { select: { name: true } },
        loggedBy: { select: { name: true } },
        counterparty: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    db.purchase.findMany({
      where: { companyId },
      include: {
        vendor: { select: { name: true } },
        destinationSite: { select: { name: true } },
        loggedBy: { select: { name: true } },
        paidBy: { select: { name: true } },
      },
      orderBy: { purchaseDate: "asc" },
    }),

    db.materialTransfer.findMany({
      where: { companyId },
      include: {
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
        loggedBy: { select: { name: true } },
      },
      orderBy: { transferDate: "asc" },
    }),

    db.siteIncome.findMany({
      where: { companyId },
      include: {
        site: { select: { name: true } },
        loggedBy: { select: { name: true } },
      },
      orderBy: { receivedDate: "asc" },
    }),
  ]);

  type Row = (string | number | null | undefined)[];
  const rows: Row[] = [];

  for (const t of walletTxns) {
    rows.push([
      csvDate(t.createdAt),
      t.type,
      t.category ?? "",
      "",
      "",
      "",
      `${t.direction === "DEBIT" ? "-" : ""}${(Number(t.amountPaise) / 100).toFixed(2)}`,
      t.site?.name ?? "",
      t.counterparty?.name ?? "",
      "",
      t.actor.name,
      t.loggedBy.name,
      t.note ?? "",
      t.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const p of purchases) {
    rows.push([
      csvDate(p.purchaseDate),
      "PURCHASE",
      "MATERIALS",
      p.itemName,
      Number(p.quantity).toFixed(4),
      p.unit,
      (Number(p.totalPaise) / 100).toFixed(2),
      p.destinationSite?.name ?? "",
      "",
      p.vendor.name,
      p.paidBy?.name ?? "Owner Direct",
      p.loggedBy.name,
      p.note ?? "",
      p.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const t of transfersIn) {
    rows.push([
      csvDate(t.transferDate),
      "MATERIAL_TRANSFER",
      "",
      t.itemName,
      Number(t.quantity).toFixed(4),
      t.unit,
      (Number(t.costMovedPaise) / 100).toFixed(2),
      `${t.fromSite?.name ?? "Central Store"} → ${t.toSite.name}`,
      "",
      "",
      "",
      t.loggedBy.name,
      t.note ?? "",
      t.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const inc of incomes) {
    rows.push([
      csvDate(inc.receivedDate),
      `INCOME_${inc.type}`,
      "",
      "",
      "",
      "",
      (Number(inc.amountPaise) / 100).toFixed(2),
      inc.site.name,
      "",
      "",
      "",
      inc.loggedBy.name,
      inc.note ?? "",
      inc.voidedAt ? "Yes" : "No",
    ]);
  }

  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const csv = buildCsv(HEADERS, rows);
  const filename = `constructhub_company_${csvDateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
