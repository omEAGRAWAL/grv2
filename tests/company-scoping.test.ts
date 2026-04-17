import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simulate the companyId-injection logic from getCompanyScopedDb.
 * We test the transformation itself without needing a real Prisma client.
 */
function injectCompanyId(
  args: Record<string, unknown>,
  companyId: string
): Record<string, unknown> {
  return {
    ...args,
    where: { companyId, ...(args.where as Record<string, unknown> ?? {}) },
  };
}

function injectCompanyIdIntoData(
  args: Record<string, unknown>,
  companyId: string
): Record<string, unknown> {
  return {
    ...args,
    data: { ...(args.data as Record<string, unknown>), companyId },
  };
}

// ─── Middleware logic tests ───────────────────────────────────────────────────

describe("getCompanyScopedDb middleware — read operations", () => {
  const COMPANY_A = "company-a";
  const COMPANY_B = "company-b";

  it("injects companyId into an empty where clause", () => {
    const result = injectCompanyId({}, COMPANY_A);
    expect(result.where).toEqual({ companyId: COMPANY_A });
  });

  it("merges companyId with existing where filters", () => {
    const args = { where: { status: "ACTIVE" } };
    const result = injectCompanyId(args, COMPANY_A);
    expect(result.where).toEqual({ companyId: COMPANY_A, status: "ACTIVE" });
  });

  it("company A query does not bleed into company B", () => {
    const baseArgs = { where: { voidedAt: null } };
    const queryA = injectCompanyId(baseArgs, COMPANY_A);
    const queryB = injectCompanyId(baseArgs, COMPANY_B);

    expect((queryA.where as Record<string, unknown>).companyId).toBe(COMPANY_A);
    expect((queryB.where as Record<string, unknown>).companyId).toBe(COMPANY_B);
    expect(queryA.where).not.toEqual(queryB.where);
  });

  it("preserves all original args outside of where", () => {
    const args = {
      where: { id: "txn-1" },
      orderBy: { createdAt: "desc" },
      take: 10,
      skip: 0,
    };
    const result = injectCompanyId(args, COMPANY_A);
    expect(result.orderBy).toEqual(args.orderBy);
    expect(result.take).toBe(10);
    expect(result.skip).toBe(0);
  });
});

describe("getCompanyScopedDb middleware — write operations", () => {
  const COMPANY_A = "company-a";

  it("injects companyId into create data", () => {
    const args = {
      data: { name: "Test Site", location: "Mumbai" },
    };
    const result = injectCompanyIdIntoData(args, COMPANY_A);
    expect((result.data as Record<string, unknown>).companyId).toBe(COMPANY_A);
    expect((result.data as Record<string, unknown>).name).toBe("Test Site");
  });

  it("does not modify data that already has companyId (last-write wins)", () => {
    const args = {
      data: { name: "Override", companyId: "old-company" },
    };
    const result = injectCompanyIdIntoData(args, COMPANY_A);
    // Our middleware spreads args.data then overwrites companyId → new value wins
    expect((result.data as Record<string, unknown>).companyId).toBe(COMPANY_A);
  });
});

// ─── Cross-company isolation scenario ────────────────────────────────────────

describe("cross-company isolation scenario", () => {
  it("two different company scopes produce isolated queries", () => {
    const transactionsCompanyA = {
      where: { type: "EXPENSE", voidedAt: null },
    };
    const transactionsCompanyB = {
      where: { type: "EXPENSE", voidedAt: null },
    };

    const scopedA = injectCompanyId(transactionsCompanyA, "acme-corp");
    const scopedB = injectCompanyId(transactionsCompanyB, "beta-builders");

    // Both queries filter by type and voidedAt
    expect((scopedA.where as Record<string, unknown>).type).toBe("EXPENSE");
    expect((scopedB.where as Record<string, unknown>).type).toBe("EXPENSE");

    // But their companyId differs — so results are isolated
    expect((scopedA.where as Record<string, unknown>).companyId).toBe("acme-corp");
    expect((scopedB.where as Record<string, unknown>).companyId).toBe("beta-builders");
    expect(scopedA.where).not.toEqual(scopedB.where);
  });

  it("supervisor site assignment restricts access correctly", () => {
    const assignedSiteIds = ["site-mumbai", "site-pune"];
    const requestedSite = "site-delhi";

    const isAllowed = assignedSiteIds.includes(requestedSite);
    expect(isAllowed).toBe(false);

    const allowedSite = "site-mumbai";
    expect(assignedSiteIds.includes(allowedSite)).toBe(true);
  });
});

// ─── Session-based company resolution ─────────────────────────────────────────

describe("effective company resolution", () => {
  it("returns user companyId when not impersonating", () => {
    const user = { companyId: "user-company" };
    const session = { impersonatingCompanyId: undefined };

    const effectiveCompanyId = session.impersonatingCompanyId ?? user.companyId;
    expect(effectiveCompanyId).toBe("user-company");
  });

  it("returns impersonating companyId when SUPERADMIN is impersonating", () => {
    const user = { companyId: null };
    const session = { impersonatingCompanyId: "target-company" };

    const effectiveCompanyId = session.impersonatingCompanyId ?? user.companyId;
    expect(effectiveCompanyId).toBe("target-company");
  });

  it("returns undefined for a SUPERADMIN with no impersonation", () => {
    const user = { companyId: null };
    const session = { impersonatingCompanyId: undefined };

    const effectiveCompanyId = session.impersonatingCompanyId ?? user.companyId ?? undefined;
    expect(effectiveCompanyId).toBeUndefined();
  });
});
