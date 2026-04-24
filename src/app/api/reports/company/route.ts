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
  "Vendor / Source",
  "Actor",
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
  destinationSite: { name: string } | null;
  paidBy: { name: string } | null;
  loggedBy: { name: string };
  lineItems: LineItem[];
};

export async function GET() {
  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try {
    owner = await requireOwner();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyId = owner.effectiveCompanyId ?? owner.companyId;
  if (!companyId) return NextResponse.json({ error: "No company context" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

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

    anyDb.purchase.findMany({
      where: { companyId },
      include: {
        vendor: { select: { name: true } },
        destinationSite: { select: { name: true } },
        loggedBy: { select: { name: true } },
        paidBy: { select: { name: true } },
        lineItems: {
          orderBy: { displayOrder: "asc" },
          select: { itemName: true, quantity: true, unit: true, lineTotalPaise: true },
        },
      },
      orderBy: { purchaseDate: "asc" },
    }) as Promise<PurchaseRow[]>,

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
    const sourceLabel = p.vendor?.name ?? p.sellerName ?? "LOCAL";
    const voided = p.voidedAt ? "Yes" : "No";
    const siteName = p.destinationSite?.name ?? "";
    const actorName = p.paidBy?.name ?? "Owner Direct";
    const loggedByName = p.loggedBy.name;

    if (p.lineItems.length > 0) {
      // One row per line item
      for (const li of p.lineItems) {
        rows.push([
          csvDate(p.purchaseDate),
          "PURCHASE",
          "MATERIALS",
          li.itemName,
          Number(li.quantity.toString()).toFixed(4),
          li.unit,
          (Number(li.lineTotalPaise) / 100).toFixed(2),
          siteName,
          "",
          sourceLabel,
          actorName,
          loggedByName,
          p.note ?? "",
          voided,
        ]);
      }
    } else {
      // Legacy single-item
      rows.push([
        csvDate(p.purchaseDate),
        "PURCHASE",
        "MATERIALS",
        p.itemName ?? "",
        p.quantity ? Number(p.quantity.toString()).toFixed(4) : "",
        p.unit ?? "",
        (Number(p.totalPaise) / 100).toFixed(2),
        siteName,
        "",
        sourceLabel,
        actorName,
        loggedByName,
        p.note ?? "",
        voided,
      ]);
    }
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
