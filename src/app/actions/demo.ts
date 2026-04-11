"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import Decimal from "decimal.js";

function toPaise(rupees: number): bigint {
  return BigInt(new Decimal(rupees).mul(100).toFixed(0));
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

export async function resetDemo(): Promise<{ success: false; error: string } | never> {
  const owner = await requireOwner();

  // Clear in dependency order
  await db.$transaction(async (tx) => {
    await tx.siteIncome.deleteMany();
    await tx.materialTransfer.deleteMany();
    await tx.walletTransaction.deleteMany();
    await tx.purchase.deleteMany();
    await tx.site.deleteMany();
    await tx.vendor.deleteMany();
    await tx.user.deleteMany({ where: { role: "EMPLOYEE" } });
    // Do NOT delete the owner calling this action

    const empHash = await hashPassword("pass1234");
    const [ramesh, suresh, mahesh, dinesh] = await Promise.all([
      tx.user.create({ data: { username: "ramesh", passwordHash: empHash, name: "Ramesh Kumar", role: "EMPLOYEE", isActive: true } }),
      tx.user.create({ data: { username: "suresh", passwordHash: empHash, name: "Suresh Patel", role: "EMPLOYEE", isActive: true } }),
      tx.user.create({ data: { username: "mahesh", passwordHash: empHash, name: "Mahesh Verma", role: "EMPLOYEE", isActive: true } }),
      tx.user.create({ data: { username: "dinesh", passwordHash: empHash, name: "Dinesh Singh", role: "EMPLOYEE", isActive: true } }),
    ]);

    const [siteA, siteB, siteC] = await Promise.all([
      tx.site.create({ data: { name: "Sharma Residence", location: "Andheri West, Mumbai", clientName: "Rajesh Sharma", contractValuePaise: toPaise(1500000), startDate: daysAgo(60), status: "ACTIVE" } }),
      tx.site.create({ data: { name: "Patel Villa", location: "Baner, Pune", clientName: "Hardik Patel", contractValuePaise: toPaise(2200000), startDate: daysAgo(45), status: "ACTIVE" } }),
      tx.site.create({ data: { name: "Mehta Apartments", location: "Prahlad Nagar, Ahmedabad", clientName: "Mehta Builders Pvt Ltd", contractValuePaise: toPaise(4500000), startDate: daysAgo(30), status: "ACTIVE" } }),
    ]);

    const [vendorCement, vendorSteel] = await Promise.all([
      tx.vendor.create({ data: { name: "Shree Cement Suppliers", contactPhone: "9876543210", gstin: "27AABCA1234C1Z5" } }),
      tx.vendor.create({ data: { name: "Steel Mart Pvt Ltd", contactPhone: "9123456789", gstin: "07BBBCS1234D1Z9" } }),
    ]);

    // Top-ups
    for (const { u, amt, d } of [
      { u: ramesh, amt: 50000, d: 55 }, { u: suresh, amt: 40000, d: 50 },
      { u: mahesh, amt: 30000, d: 48 }, { u: dinesh, amt: 25000, d: 44 },
      { u: ramesh, amt: 30000, d: 25 }, { u: suresh, amt: 20000, d: 20 },
      { u: mahesh, amt: 15000, d: 15 },
    ]) {
      await tx.walletTransaction.create({ data: { actorUserId: u.id, loggedById: owner.id, type: "TOPUP", direction: "CREDIT", amountPaise: toPaise(amt), createdAt: daysAgo(d) } });
    }

    // Expenses (sample subset)
    for (const { u, site, amt, cat, note, d } of [
      { u: ramesh, site: siteA, amt: 3200, cat: "MATERIALS", note: "Sand bags", d: 53 },
      { u: suresh, site: siteB, amt: 4500, cat: "LABOR", note: "Daily wages", d: 49 },
      { u: mahesh, site: siteA, amt: 2200, cat: "FOOD", note: "Lunch for team", d: 47 },
      { u: dinesh, site: siteC, amt: 5500, cat: "MATERIALS", note: "Binding wire", d: 43 },
      { u: suresh, site: siteB, amt: 3800, cat: "TRANSPORT", note: "Truck rental", d: 38 },
      { u: ramesh, site: siteC, amt: 6200, cat: "LABOR", note: "Mason wages", d: 32 },
      { u: dinesh, site: siteA, amt: 4100, cat: "MATERIALS", note: "PVC pipes", d: 22 },
      { u: mahesh, site: siteC, amt: 3600, cat: "MATERIALS", note: "Tiles and adhesive", d: 8 },
    ] as const) {
      await tx.walletTransaction.create({ data: { actorUserId: u.id, loggedById: u.id, type: "EXPENSE", direction: "DEBIT", amountPaise: toPaise(amt), siteId: site.id, category: cat, note, createdAt: daysAgo(d) } });
    }

    // Peer transfer
    const tDate = daysAgo(30);
    await tx.walletTransaction.create({ data: { actorUserId: ramesh.id, loggedById: owner.id, type: "TRANSFER_OUT", direction: "DEBIT", amountPaise: toPaise(8000), counterpartyUserId: suresh.id, createdAt: tDate } });
    await tx.walletTransaction.create({ data: { actorUserId: suresh.id, loggedById: owner.id, type: "TRANSFER_IN", direction: "CREDIT", amountPaise: toPaise(8000), counterpartyUserId: ramesh.id, createdAt: tDate } });

    // Cement purchase
    const cement = await tx.purchase.create({ data: { vendorId: vendorCement.id, itemName: "Cement 50kg", quantity: new Decimal("50"), unit: "bags", ratePaise: toPaise(380), discountPercent: new Decimal("5"), gstPercent: new Decimal("18"), totalPaise: toPaise(21299), destinationSiteId: siteA.id, paidByUserId: ramesh.id, purchaseDate: daysAgo(42), loggedById: owner.id, createdAt: daysAgo(42) } });
    await tx.walletTransaction.create({ data: { actorUserId: ramesh.id, loggedById: owner.id, type: "VENDOR_PAYMENT", direction: "DEBIT", amountPaise: toPaise(21299), siteId: siteA.id, relatedPurchaseId: cement.id, createdAt: daysAgo(42) } });

    // Owner-direct purchase
    await tx.purchase.create({ data: { vendorId: vendorSteel.id, itemName: "TMT Steel Bars 12mm", quantity: new Decimal("20"), unit: "nos", ratePaise: toPaise(850), discountPercent: new Decimal("0"), gstPercent: new Decimal("18"), totalPaise: toPaise(20060), destinationSiteId: siteB.id, paidByUserId: null, purchaseDate: daysAgo(35), loggedById: owner.id, createdAt: daysAgo(35) } });

    // Material transfer
    await tx.materialTransfer.create({ data: { fromSiteId: siteA.id, toSiteId: siteC.id, itemName: "Cement 50kg", quantity: new Decimal("20"), unit: "bags", costMovedPaise: toPaise(8520), transferDate: daysAgo(28), loggedById: owner.id, note: "Surplus cement moved to Mehta Apartments", createdAt: daysAgo(28) } });

    // Site incomes
    for (const { site, amt, type, note, d } of [
      { site: siteA, amt: 500000, type: "ADVANCE", note: "First advance — 33% of contract", d: 58 },
      { site: siteA, amt: 350000, type: "RUNNING_BILL", note: "Running bill #1", d: 20 },
      { site: siteB, amt: 700000, type: "ADVANCE", note: "Mobilisation advance", d: 44 },
      { site: siteC, amt: 1200000, type: "ADVANCE", note: "Advance — 27% of contract value", d: 28 },
    ] as const) {
      await tx.siteIncome.create({ data: { siteId: site.id, amountPaise: toPaise(amt), receivedDate: daysAgo(d), type, note, loggedById: owner.id, createdAt: daysAgo(d) } });
    }
  });

  redirect("/dashboard");
}
