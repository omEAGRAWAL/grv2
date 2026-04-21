import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBulkAttendance } from "@/app/actions/bulk-attendance";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: vi.fn() },
    attendance: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_A = "company-alpha";

const ownerA = {
  id: "owner-a",
  role: "OWNER",
  companyId: COMPANY_A,
  effectiveCompanyId: COMPANY_A,
};

const employees = [
  { id: "emp-1", name: "Ramesh", companyId: COMPANY_A },
  { id: "emp-2", name: "Suresh", companyId: COMPANY_A },
  { id: "emp-3", name: "Mohan", companyId: COMPANY_A },
  { id: "emp-4", name: "Lokesh", companyId: COMPANY_A },
  { id: "emp-5", name: "Ganesh", companyId: COMPANY_A },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysFromNowISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(ownerA as never);
  vi.mocked(db.user.findMany).mockResolvedValue(employees as never);
  vi.mocked(db.attendance.findMany).mockResolvedValue([]);
  vi.mocked(db.attendance.create).mockResolvedValue({} as never);
  vi.mocked(db.attendance.update).mockResolvedValue({} as never);
  // Reset $transaction to default pass-through after each test
  vi.mocked(db.$transaction).mockImplementation(
    async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
  );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createBulkAttendance", () => {
  it("bulk marks 5 employees present for today", async () => {
    const entries = employees.map((e) => ({ userId: e.id, status: "PRESENT" as const }));
    const result = await createBulkAttendance(todayISO(), entries);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.created).toBe(5);
      expect(result.updated).toBe(0);
      expect(result.skipped).toHaveLength(0);
    }
    expect(vi.mocked(db.attendance.create)).toHaveBeenCalledTimes(5);
  });

  it("does not overwrite existing SELFIE attendance", async () => {
    vi.mocked(db.attendance.findMany).mockResolvedValue([
      { userId: "emp-1", method: "SELFIE" } as never,
    ]);

    const result = await createBulkAttendance(todayISO(), [
      { userId: "emp-1", status: "PRESENT" },
      { userId: "emp-2", status: "PRESENT" },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].userName).toBe("Ramesh");
      expect(result.skipped[0].reason).toMatch(/selfie/i);
    }
    expect(vi.mocked(db.attendance.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.attendance.update)).not.toHaveBeenCalled();
  });

  it("overwrites existing MANUAL attendance with new status", async () => {
    vi.mocked(db.attendance.findMany).mockResolvedValue([
      { userId: "emp-1", method: "MANUAL" } as never,
    ]);

    const result = await createBulkAttendance(todayISO(), [
      { userId: "emp-1", status: "ABSENT" },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
      expect(result.skipped).toHaveLength(0);
    }
    expect(vi.mocked(db.attendance.update)).toHaveBeenCalledOnce();
    expect(vi.mocked(db.attendance.create)).not.toHaveBeenCalled();
  });

  it("rejects future dates", async () => {
    const result = await createBulkAttendance(
      daysFromNowISO(1),
      [{ userId: "emp-1", status: "PRESENT" }]
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/future/i);
    expect(vi.mocked(db.attendance.create)).not.toHaveBeenCalled();
  });

  it("rejects dates more than 30 days in the past", async () => {
    const result = await createBulkAttendance(
      daysAgoISO(40),
      [{ userId: "emp-1", status: "PRESENT" }]
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/30 days/i);
    expect(vi.mocked(db.attendance.create)).not.toHaveBeenCalled();
  });

  it("SKIP status entries do not create any rows", async () => {
    const result = await createBulkAttendance(todayISO(), [
      { userId: "emp-1", status: "SKIP" },
      { userId: "emp-2", status: "SKIP" },
      { userId: "emp-3", status: "SKIP" },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    }
    expect(vi.mocked(db.attendance.create)).not.toHaveBeenCalled();
  });

  it("partial failure rolls back the whole batch via transaction", async () => {
    vi.mocked(db.$transaction).mockRejectedValue(new Error("DB constraint"));

    const entries = employees.map((e) => ({ userId: e.id, status: "PRESENT" as const }));
    const result = await createBulkAttendance(todayISO(), entries);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/failed/i);
  });

  it("rejects unauthorized caller", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));

    const result = await createBulkAttendance(todayISO(), [
      { userId: "emp-1", status: "PRESENT" },
    ]);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/unauthorized/i);
  });

  it("accepts the boundary date (30 days ago)", async () => {
    const result = await createBulkAttendance(
      daysAgoISO(30),
      [{ userId: "emp-1", status: "PRESENT" }]
    );

    // 30 days ago is at the boundary — should succeed
    expect(result.success).toBe(true);
  });

  it("creates rows with MANUAL method and loggedById set to caller", async () => {
    await createBulkAttendance(todayISO(), [
      { userId: "emp-1", status: "PRESENT" },
    ]);

    expect(vi.mocked(db.attendance.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: "MANUAL",
        markedById: ownerA.id,
        status: "PRESENT",
        companyId: COMPANY_A,
      }),
    });
  });
});
