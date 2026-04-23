import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTransfer } from "@/app/actions/transfers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";

vi.mock("@/lib/db", () => {
  const mockDb = {
    user: { findFirst: vi.fn() },
    walletTransaction: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/wallet", () => ({ getWalletBalance: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const mockEmployee = { id: "emp1", role: "EMPLOYEE", name: "Ravi", isActive: true };
const mockOwner    = { id: "own1", role: "OWNER",    name: "Owner", isActive: true };
const mockEmp2     = { id: "emp2", role: "EMPLOYEE", name: "Suresh", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.user.findFirst)
    .mockResolvedValueOnce(mockEmployee as any)   // fromUser
    .mockResolvedValueOnce(mockEmp2 as any);      // toUser
  vi.mocked(db.walletTransaction.create).mockResolvedValue({} as any);
  vi.mocked(getWalletBalance).mockResolvedValue(50000n);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ─── createTransfer ───────────────────────────────────────────────────────────

describe("createTransfer", () => {
  it("creates exactly two balanced WalletTransactions", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);

    await createTransfer(
      null,
      makeForm({ fromUserId: "emp1", toUserId: "emp2", amountPaise: "10000" })
    ).catch(() => {});

    expect(vi.mocked(db.walletTransaction.create)).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(db.walletTransaction.create).mock.calls;
    const [first, second] = calls.map((c) => c[0].data);

    expect(first).toMatchObject({
      actorUserId: "emp1",
      type: "TRANSFER_OUT",
      direction: "DEBIT",
      amountPaise: 10000n,
      counterpartyUserId: "emp2",
    });
    expect(second).toMatchObject({
      actorUserId: "emp2",
      type: "TRANSFER_IN",
      direction: "CREDIT",
      amountPaise: 10000n,
      counterpartyUserId: "emp1",
    });
  });

  it("both rows are inside db.$transaction (rolls back on failure)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);

    // Make the second insert fail
    vi.mocked(db.walletTransaction.create)
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error("DB error"));

    // $transaction itself re-throws, simulating rollback
    vi.mocked(db.$transaction).mockImplementationOnce(async (fn) => {
      return fn(db); // will throw on second create
    });

    await expect(
      createTransfer(
        null,
        makeForm({ fromUserId: "emp1", toUserId: "emp2", amountPaise: "10000" })
      )
    ).rejects.toThrow();
  });

  it("cannot transfer to self", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);

    const result = await createTransfer(
      null,
      makeForm({ fromUserId: "emp1", toUserId: "emp1", amountPaise: "10000" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/yourself/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails with insufficient balance", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(5000n); // ₹50, need ₹100

    const result = await createTransfer(
      null,
      makeForm({ fromUserId: "emp1", toUserId: "emp2", amountPaise: "10000" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/insufficient/i);
  });

  it("employee cannot specify a different fromUserId (server enforces)", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);
    vi.mocked(getWalletBalance).mockResolvedValue(50000n);

    // Employee tries to send FROM a different user
    const result = await createTransfer(
      null,
      makeForm({ fromUserId: "emp99", toUserId: "emp2", amountPaise: "10000" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/can only transfer from your own/i);
    expect(vi.mocked(db.walletTransaction.create)).not.toHaveBeenCalled();
  });

  it("fails with zero amount", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockEmployee as any);

    const result = await createTransfer(
      null,
      makeForm({ fromUserId: "emp1", toUserId: "emp2", amountPaise: "0" })
    );

    expect(result?.success).toBe(false);
    expect(result?.error).toMatch(/greater than/i);
  });
});
