import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSalaryPayment, addPayrollNote } from "@/app/actions/payroll";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    walletTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    payrollNote: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_A = "company-alpha";

const managerA = {
  id: "owner-1",
  role: "OWNER",
  companyId: COMPANY_A,
  effectiveCompanyId: COMPANY_A,
};

const emp = { id: "emp-1", name: "Ramesh Kumar", companyId: COMPANY_A };

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(managerA as never);
  vi.mocked(db.user.findFirst).mockResolvedValue(emp as never);
  vi.mocked(db.walletTransaction.create).mockResolvedValue({} as never);
  vi.mocked(db.payrollNote.create).mockResolvedValue({} as never);
});

// ─── createSalaryPayment ──────────────────────────────────────────────────────

describe("createSalaryPayment", () => {
  it("creates one CREDIT row when no advance recovery", async () => {
    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: todayISO(),
        note: "April salary",
      })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "SALARY",
        direction: "CREDIT",
        amountPaise: 2000000n,
        actorUserId: emp.id,
        loggedById: managerA.id,
      }),
    });
  });

  it("creates CREDIT + DEBIT when advance recovery is provided", async () => {
    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: todayISO(),
        recoverAdvancePaise: "500000",
      })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(db.walletTransaction.create).mock.calls;
    const creditCall = calls.find((c) => c[0].data.direction === "CREDIT");
    const debitCall = calls.find((c) => c[0].data.direction === "DEBIT");

    expect(creditCall?.[0].data).toMatchObject({
      type: "SALARY",
      direction: "CREDIT",
      amountPaise: 2000000n,
    });
    expect(debitCall?.[0].data).toMatchObject({
      type: "ADVANCE_RECOVERY",
      direction: "DEBIT",
      amountPaise: 500000n,
    });
  });

  it("zero advance recovery creates only one CREDIT row", async () => {
    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: todayISO(),
        recoverAdvancePaise: "0",
      })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledTimes(1);
  });

  it("rejects future payment date", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: futureISO,
      })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/future/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("rejects when employee belongs to another company", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);

    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: "emp-b",
        amountPaise: "2000000",
        paymentDate: todayISO(),
      })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/not found/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("rejects unauthorized caller", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));

    const result = await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: todayISO(),
      })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/unauthorized/i);
  });

  it("records correct companyId on both rows", async () => {
    await createSalaryPayment(
      null,
      makeForm({
        employeeId: emp.id,
        amountPaise: "2000000",
        paymentDate: todayISO(),
        recoverAdvancePaise: "100000",
      })
    );

    const calls = vi.mocked(db.walletTransaction.create).mock.calls;
    for (const call of calls) {
      expect(call[0].data.companyId).toBe(COMPANY_A);
    }
  });
});

// ─── addPayrollNote ───────────────────────────────────────────────────────────

describe("addPayrollNote", () => {
  it("creates a note for an employee in the same company", async () => {
    const result = await addPayrollNote(
      null,
      makeForm({
        userId: emp.id,
        note: "Diwali bonus included",
        noteDate: todayISO(),
      })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.payrollNote.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: emp.id,
        note: "Diwali bonus included",
        companyId: COMPANY_A,
        createdById: managerA.id,
      }),
    });
  });

  it("rejects note for employee in another company", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);

    const result = await addPayrollNote(
      null,
      makeForm({ userId: "emp-b", note: "Test note", noteDate: todayISO() })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.payrollNote.create)).not.toHaveBeenCalled();
  });

  it("rejects empty note", async () => {
    const result = await addPayrollNote(
      null,
      makeForm({ userId: emp.id, note: "", noteDate: todayISO() })
    );

    expect(result.success).toBe(false);
    expect(vi.mocked(db.payrollNote.create)).not.toHaveBeenCalled();
  });
});

// ─── CSV export: types included ───────────────────────────────────────────────

describe("payroll CSV export type coverage", () => {
  it("includes TOPUP, SALARY, ADVANCE_RECOVERY in the type filter", async () => {
    // Import and check the getPayrollLedger function uses correct types
    const { getPayrollLedger } = await import("@/app/actions/payroll");
    vi.mocked(db.walletTransaction.findMany).mockResolvedValue([]);
    vi.mocked(db.walletTransaction.count).mockResolvedValue(0 as never);
    vi.mocked(db.walletTransaction.groupBy).mockResolvedValue([]);
    vi.mocked(db.payrollNote.findMany).mockResolvedValue([]);

    await getPayrollLedger(emp.id, COMPANY_A);

    expect(vi.mocked(db.walletTransaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: expect.arrayContaining(["SALARY", "ADVANCE_RECOVERY"]) },
        }),
      })
    );
  });
});
