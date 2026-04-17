/**
 * Demo seed: creates a complete dataset for pilot demonstrations.
 *
 * Run: pnpm seed:demo
 *
 * CAUTION: this script clears ALL existing data before seeding.
 * A confirmation prompt is shown to prevent accidents.
 */

import { config } from "dotenv";
config({ path: new URL("../.env", import.meta.url).pathname });

import { createInterface } from "readline";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import Decimal from "decimal.js";

function toPaise(rupees: number): bigint {
  return BigInt(new Decimal(rupees).mul(100).toFixed(0));
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

const DEMO_COMPANY_ID = "demo-company";

async function main() {
  console.log("\n─── ConstructHub Demo Seed ───\n");
  console.log("WARNING: This will DELETE all existing data and replace it with demo data.");
  const confirm = await prompt("Type YES to continue: ");
  if (confirm !== "YES") {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("\nClearing existing data...");
  // Clear in dependency order (FK constraints)
  await db.siteAssignment.deleteMany();
  await db.siteIncome.deleteMany();
  await db.materialTransfer.deleteMany();
  await db.walletTransaction.deleteMany();
  await db.purchase.deleteMany();
  await db.site.deleteMany();
  await db.vendor.deleteMany();
  await db.user.deleteMany();
  await db.company.deleteMany();

  console.log("Creating demo company...");
  await db.company.create({
    data: {
      id: DEMO_COMPANY_ID,
      name: "Demo Construction Co.",
      status: "ACTIVE",
    },
  });

  console.log("Creating users...");

  const ownerHash = await hashPassword("demo1234");
  const owner = await db.user.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      username: "demo_owner",
      passwordHash: ownerHash,
      name: "Vikram Sharma",
      role: "OWNER",
      isActive: true,
    },
  });

  const empHash = await hashPassword("pass1234");
  const [ramesh, suresh, mahesh, dinesh] = await Promise.all([
    db.user.create({ data: { companyId: DEMO_COMPANY_ID, username: "ramesh", passwordHash: empHash, name: "Ramesh Kumar", role: "EMPLOYEE", isActive: true } }),
    db.user.create({ data: { companyId: DEMO_COMPANY_ID, username: "suresh", passwordHash: empHash, name: "Suresh Patel", role: "EMPLOYEE", isActive: true } }),
    db.user.create({ data: { companyId: DEMO_COMPANY_ID, username: "mahesh", passwordHash: empHash, name: "Mahesh Verma", role: "EMPLOYEE", isActive: true } }),
    db.user.create({ data: { companyId: DEMO_COMPANY_ID, username: "dinesh", passwordHash: empHash, name: "Dinesh Singh", role: "EMPLOYEE", isActive: true } }),
  ]);

  console.log("Creating sites...");

  const [siteA, siteB, siteC] = await Promise.all([
    db.site.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        name: "Sharma Residence",
        location: "Andheri West, Mumbai",
        clientName: "Rajesh Sharma",
        contractValuePaise: toPaise(1500000),
        startDate: daysAgo(60),
        expectedEndDate: new Date(Date.now() + 90 * 86400000),
        status: "ACTIVE",
      },
    }),
    db.site.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        name: "Patel Villa",
        location: "Baner, Pune",
        clientName: "Hardik Patel",
        contractValuePaise: toPaise(2200000),
        startDate: daysAgo(45),
        expectedEndDate: new Date(Date.now() + 120 * 86400000),
        status: "ACTIVE",
      },
    }),
    db.site.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        name: "Mehta Apartments",
        location: "Prahlad Nagar, Ahmedabad",
        clientName: "Mehta Builders Pvt Ltd",
        contractValuePaise: toPaise(4500000),
        startDate: daysAgo(30),
        expectedEndDate: new Date(Date.now() + 180 * 86400000),
        status: "ACTIVE",
      },
    }),
  ]);

  console.log("Creating vendors...");
  const [vendorCement, vendorSteel] = await Promise.all([
    db.vendor.create({
      data: { companyId: DEMO_COMPANY_ID, name: "Shree Cement Suppliers", contactPhone: "9876543210", gstin: "27AABCA1234C1Z5" },
    }),
    db.vendor.create({
      data: { companyId: DEMO_COMPANY_ID, name: "Steel Mart Pvt Ltd", contactPhone: "9123456789", gstin: "07BBBCS1234D1Z9" },
    }),
  ]);

  console.log("Creating wallet top-ups...");

  const topups = [
    { user: ramesh, amount: 50000, daysBack: 55 },
    { user: suresh, amount: 40000, daysBack: 50 },
    { user: mahesh, amount: 30000, daysBack: 48 },
    { user: dinesh, amount: 25000, daysBack: 44 },
    { user: ramesh, amount: 30000, daysBack: 25 },
    { user: suresh, amount: 20000, daysBack: 20 },
    { user: mahesh, amount: 15000, daysBack: 15 },
  ];

  for (const { user: emp, amount, daysBack } of topups) {
    await db.walletTransaction.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        actorUserId: emp.id,
        loggedById: owner.id,
        type: "TOPUP",
        direction: "CREDIT",
        amountPaise: toPaise(amount),
        createdAt: daysAgo(daysBack),
      },
    });
  }

  console.log("Creating expenses...");

  const expenses = [
    { emp: ramesh, site: siteA, amount: 3200, cat: "MATERIALS", note: "Sand bags", daysBack: 53 },
    { emp: ramesh, site: siteA, amount: 1800, cat: "TRANSPORT", note: "Auto-rickshaw for cement", daysBack: 51 },
    { emp: suresh, site: siteB, amount: 4500, cat: "LABOR", note: "Daily wages - 3 workers", daysBack: 49 },
    { emp: mahesh, site: siteA, amount: 2200, cat: "FOOD", note: "Lunch for team", daysBack: 47 },
    { emp: dinesh, site: siteC, amount: 5500, cat: "MATERIALS", note: "Binding wire and nails", daysBack: 43 },
    { emp: suresh, site: siteB, amount: 3800, cat: "TRANSPORT", note: "Truck rental for bricks", daysBack: 38 },
    { emp: ramesh, site: siteC, amount: 6200, cat: "LABOR", note: "Mason daily wages", daysBack: 32 },
    { emp: mahesh, site: siteB, amount: 1500, cat: "MISC", note: "Stationery and site register", daysBack: 28 },
    { emp: dinesh, site: siteA, amount: 4100, cat: "MATERIALS", note: "PVC pipes", daysBack: 22 },
    { emp: suresh, site: siteC, amount: 7200, cat: "LABOR", note: "Plastering team - 2 days", daysBack: 18 },
    { emp: ramesh, site: siteA, amount: 2900, cat: "TRANSPORT", note: "Material delivery from Bhiwandi", daysBack: 12 },
    { emp: mahesh, site: siteC, amount: 3600, cat: "MATERIALS", note: "Tiles and adhesive", daysBack: 8 },
  ] as const;

  for (const { emp, site, amount, cat, note, daysBack } of expenses) {
    await db.walletTransaction.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        actorUserId: emp.id,
        loggedById: emp.id,
        type: "EXPENSE",
        direction: "DEBIT",
        amountPaise: toPaise(amount),
        siteId: site.id,
        category: cat,
        note,
        createdAt: daysAgo(daysBack),
      },
    });
  }

  console.log("Creating transfers between employees...");

  const transferPairs = [
    { from: ramesh, to: suresh, amount: 8000, daysBack: 40 },
    { from: suresh, to: mahesh, amount: 5000, daysBack: 30 },
  ];
  for (const { from, to, amount, daysBack } of transferPairs) {
    const createdAt = daysAgo(daysBack);
    await db.walletTransaction.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        actorUserId: from.id,
        loggedById: owner.id,
        type: "TRANSFER_OUT",
        direction: "DEBIT",
        amountPaise: toPaise(amount),
        counterpartyUserId: to.id,
        createdAt,
      },
    });
    await db.walletTransaction.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        actorUserId: to.id,
        loggedById: owner.id,
        type: "TRANSFER_IN",
        direction: "CREDIT",
        amountPaise: toPaise(amount),
        counterpartyUserId: from.id,
        createdAt,
      },
    });
  }

  console.log("Creating vendor purchases...");

  const cement50 = await db.purchase.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      vendorId: vendorCement.id,
      itemName: "Cement 50kg",
      quantity: new Decimal("50"),
      unit: "bags",
      ratePaise: toPaise(380),
      discountPercent: new Decimal("5"),
      gstPercent: new Decimal("18"),
      totalPaise: toPaise(21299),
      destinationSiteId: siteA.id,
      paidByUserId: ramesh.id,
      purchaseDate: daysAgo(42),
      loggedById: owner.id,
      note: "OPC 53 grade cement",
      createdAt: daysAgo(42),
    },
  });
  await db.walletTransaction.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      actorUserId: ramesh.id,
      loggedById: owner.id,
      type: "VENDOR_PAYMENT",
      direction: "DEBIT",
      amountPaise: toPaise(21299),
      siteId: siteA.id,
      relatedPurchaseId: cement50.id,
      createdAt: daysAgo(42),
    },
  });

  const steelRods = await db.purchase.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      vendorId: vendorSteel.id,
      itemName: "TMT Steel Bars 12mm",
      quantity: new Decimal("20"),
      unit: "nos",
      ratePaise: toPaise(850),
      discountPercent: new Decimal("0"),
      gstPercent: new Decimal("18"),
      totalPaise: toPaise(20060),
      destinationSiteId: siteB.id,
      paidByUserId: suresh.id,
      purchaseDate: daysAgo(35),
      loggedById: owner.id,
      createdAt: daysAgo(35),
    },
  });
  await db.walletTransaction.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      actorUserId: suresh.id,
      loggedById: owner.id,
      type: "VENDOR_PAYMENT",
      direction: "DEBIT",
      amountPaise: toPaise(20060),
      siteId: siteB.id,
      relatedPurchaseId: steelRods.id,
      createdAt: daysAgo(35),
    },
  });

  await db.purchase.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      vendorId: vendorCement.id,
      itemName: "M-sand (Manufactured Sand)",
      quantity: new Decimal("10"),
      unit: "tons",
      ratePaise: toPaise(1200),
      discountPercent: new Decimal("0"),
      gstPercent: new Decimal("18"),
      totalPaise: toPaise(14160),
      destinationSiteId: siteC.id,
      paidByUserId: null,
      purchaseDate: daysAgo(20),
      loggedById: owner.id,
      createdAt: daysAgo(20),
    },
  });

  await db.purchase.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      vendorId: vendorSteel.id,
      itemName: "AAC Blocks 600×200×200",
      quantity: new Decimal("500"),
      unit: "pcs",
      ratePaise: toPaise(55),
      discountPercent: new Decimal("2"),
      gstPercent: new Decimal("12"),
      totalPaise: toPaise(30184),
      destinationSiteId: siteA.id,
      paidByUserId: null,
      purchaseDate: daysAgo(14),
      loggedById: owner.id,
      createdAt: daysAgo(14),
    },
  });

  console.log("Creating material transfers...");

  await db.materialTransfer.create({
    data: {
      companyId: DEMO_COMPANY_ID,
      fromSiteId: siteA.id,
      toSiteId: siteC.id,
      itemName: "Cement 50kg",
      quantity: new Decimal("20"),
      unit: "bags",
      costMovedPaise: toPaise(8520),
      transferDate: daysAgo(28),
      loggedById: owner.id,
      note: "Surplus cement moved to Mehta Apartments",
      createdAt: daysAgo(28),
    },
  });

  console.log("Creating site income records...");

  const incomes = [
    { site: siteA, amount: 500000, type: "ADVANCE", note: "First advance — 33% of contract", daysBack: 58 },
    { site: siteA, amount: 350000, type: "RUNNING_BILL", note: "Running bill #1 — foundation work", daysBack: 20 },
    { site: siteB, amount: 700000, type: "ADVANCE", note: "Mobilisation advance", daysBack: 44 },
    { site: siteB, amount: 400000, type: "RUNNING_BILL", note: "Running bill #1", daysBack: 15 },
    { site: siteC, amount: 1200000, type: "ADVANCE", note: "Advance — 27% of contract value", daysBack: 28 },
  ] as const;

  for (const { site, amount, type, note, daysBack } of incomes) {
    await db.siteIncome.create({
      data: {
        companyId: DEMO_COMPANY_ID,
        siteId: site.id,
        amountPaise: toPaise(amount),
        receivedDate: daysAgo(daysBack),
        type,
        note,
        loggedById: owner.id,
        createdAt: daysAgo(daysBack),
      },
    });
  }

  console.log("\n✓ Demo seed complete!\n");
  console.log("  Owner    : demo_owner / demo1234");
  console.log("  Employees: ramesh, suresh, mahesh, dinesh / pass1234");
  console.log("  Sites    : Sharma Residence, Patel Villa, Mehta Apartments");
  console.log("  Vendors  : Shree Cement Suppliers, Steel Mart Pvt Ltd");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message);
  process.exit(1);
});
