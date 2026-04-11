import { type NextRequest, NextResponse } from "next/server";
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
  "Logged By",
  "Note",
  "Voided",
];

export async function GET(req: NextRequest) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const site = await db.site.findUnique({
    where: { id: siteId },
    select: { id: true, name: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const [walletTxns, purchases, transfersIn, transfersOut, incomes] =
    await Promise.all([
      db.walletTransaction.findMany({
        where: { siteId },
        include: {
          actor: { select: { name: true } },
          loggedBy: { select: { name: true } },
          counterparty: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),

      db.purchase.findMany({
        where: { destinationSiteId: siteId },
        include: {
          vendor: { select: { name: true } },
          loggedBy: { select: { name: true } },
        },
        orderBy: { purchaseDate: "asc" },
      }),

      db.materialTransfer.findMany({
        where: { toSiteId: siteId },
        include: {
          fromSite: { select: { name: true } },
          loggedBy: { select: { name: true } },
        },
        orderBy: { transferDate: "asc" },
      }),

      db.materialTransfer.findMany({
        where: { fromSiteId: siteId },
        include: {
          toSite: { select: { name: true } },
          loggedBy: { select: { name: true } },
        },
        orderBy: { transferDate: "asc" },
      }),

      db.siteIncome.findMany({
        where: { siteId },
        include: { loggedBy: { select: { name: true } } },
        orderBy: { receivedDate: "asc" },
      }),
    ]);

  type Row = (string | number | bigint | null | undefined)[];
  const rows: Row[] = [];

  for (const t of walletTxns) {
    const sign = t.direction === "CREDIT" ? 1n : -1n;
    rows.push([
      csvDate(t.createdAt),
      t.type,
      t.category ?? "",
      "",
      "",
      "",
      (sign * t.amountPaise).toString().replace(/^-/, "-").replace(/^(\d)/, "$1"),
      site.name,
      t.counterparty?.name ?? "",
      "",
      t.loggedBy.name,
      t.note ?? "",
      t.voidedAt ? "Yes" : "No",
    ]);
    // Fix: output as rupees
    rows[rows.length - 1][6] =
      `${t.direction === "DEBIT" ? "-" : ""}${(Number(t.amountPaise) / 100).toFixed(2)}`;
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
      site.name,
      "",
      p.vendor.name,
      p.loggedBy.name,
      p.note ?? "",
      p.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const t of transfersIn) {
    rows.push([
      csvDate(t.transferDate),
      "TRANSFER_IN",
      "",
      t.itemName,
      Number(t.quantity).toFixed(4),
      t.unit,
      (Number(t.costMovedPaise) / 100).toFixed(2),
      site.name,
      t.fromSite?.name ?? "Central Store",
      "",
      t.loggedBy.name,
      t.note ?? "",
      t.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const t of transfersOut) {
    rows.push([
      csvDate(t.transferDate),
      "TRANSFER_OUT",
      "",
      t.itemName,
      Number(t.quantity).toFixed(4),
      t.unit,
      `-${(Number(t.costMovedPaise) / 100).toFixed(2)}`,
      site.name,
      t.toSite.name,
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
      site.name,
      "",
      "",
      inc.loggedBy.name,
      inc.note ?? "",
      inc.voidedAt ? "Yes" : "No",
    ]);
  }

  // Sort all rows by date (column 0)
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const csv = buildCsv(HEADERS, rows);
  const filename = `constructhub_site_${csvDateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
