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
  "Vendor / Source",
  "Logged By",
  "Note",
  "Voided",
];

type LineItem = {
  itemName: string;
  quantity: { toString: () => string };
  unit: string;
  lineTotalPaise: bigint;
};

type PurchaseRow = {
  id: string;
  purchaseDate: Date;
  totalPaise: bigint;
  itemName: string | null;
  quantity: { toString: () => string } | null;
  unit: string | null;
  note: string | null;
  voidedAt: Date | null;
  vendor: { name: string } | null;
  sellerName: string | null;
  loggedBy: { name: string };
  lineItems: LineItem[];
};

export async function GET(req: NextRequest) {
  let owner;
  try {
    owner = await requireOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const companyId = owner.effectiveCompanyId!;
  const site = await db.site.findFirst({
    where: { id: siteId, companyId },
    select: { id: true, name: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const [walletTxns, purchases, transfersIn, transfersOut, incomes] = await Promise.all([
    db.walletTransaction.findMany({
      where: { siteId },
      include: {
        actor: { select: { name: true } },
        loggedBy: { select: { name: true } },
        counterparty: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    anyDb.purchase.findMany({
      where: { destinationSiteId: siteId },
      include: {
        vendor: { select: { name: true } },
        loggedBy: { select: { name: true } },
        lineItems: {
          orderBy: { displayOrder: "asc" },
          select: { itemName: true, quantity: true, unit: true, lineTotalPaise: true },
        },
      },
      orderBy: { purchaseDate: "asc" },
    }) as Promise<PurchaseRow[]>,

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
      site.name,
      t.counterparty?.name ?? "",
      "",
      t.loggedBy.name,
      t.note ?? "",
      t.voidedAt ? "Yes" : "No",
    ]);
  }

  for (const p of purchases) {
    const sourceLabel = p.vendor?.name ?? (p as any).sellerName ?? "LOCAL";
    const voided = p.voidedAt ? "Yes" : "No";
    const loggedByName = p.loggedBy.name;

    if (p.lineItems.length > 0) {
      for (const li of p.lineItems) {
        rows.push([
          csvDate(p.purchaseDate),
          "PURCHASE",
          "MATERIALS",
          li.itemName,
          Number(li.quantity.toString()).toFixed(4),
          li.unit,
          (Number(li.lineTotalPaise) / 100).toFixed(2),
          site.name,
          "",
          sourceLabel,
          loggedByName,
          p.note ?? "",
          voided,
        ]);
      }
    } else {
      rows.push([
        csvDate(p.purchaseDate),
        "PURCHASE",
        "MATERIALS",
        p.itemName ?? "",
        p.quantity ? Number(p.quantity.toString()).toFixed(4) : "",
        p.unit ?? "",
        (Number(p.totalPaise) / 100).toFixed(2),
        site.name,
        "",
        sourceLabel,
        loggedByName,
        p.note ?? "",
        voided,
      ]);
    }
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
