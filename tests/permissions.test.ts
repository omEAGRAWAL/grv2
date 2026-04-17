import { describe, it, expect } from "vitest";
import { can, assertCan, type Action } from "@/lib/permissions";
import type { User } from "@prisma/client";

function makeUser(role: string): Pick<User, "role"> {
  return { role: role as User["role"] };
}

// ─── Role permission matrix ───────────────────────────────────────────────────

describe("can() — SUPERADMIN", () => {
  const user = makeUser("SUPERADMIN");

  it("can do everything including super:admin", () => {
    const allActions: Action[] = [
      "super:admin", "manage:company",
      "create:site", "update:site", "view:site",
      "create:employee", "update:employee", "reset:employee-password",
      "topup:wallet", "create:expense", "void:expense",
      "create:transfer", "void:transfer",
      "create:purchase", "void:purchase",
      "create:material-transfer", "void:material-transfer",
      "create:income", "void:income",
      "view:reports", "export:csv", "manage:vendors",
    ];
    for (const action of allActions) {
      expect(can(user, action), `SUPERADMIN should be able to ${action}`).toBe(true);
    }
  });
});

describe("can() — OWNER", () => {
  const user = makeUser("OWNER");

  it("can manage company and all financial operations", () => {
    expect(can(user, "manage:company")).toBe(true);
    expect(can(user, "create:site")).toBe(true);
    expect(can(user, "topup:wallet")).toBe(true);
    expect(can(user, "void:expense")).toBe(true);
    expect(can(user, "export:csv")).toBe(true);
    expect(can(user, "manage:vendors")).toBe(true);
  });

  it("cannot access super:admin panel", () => {
    expect(can(user, "super:admin")).toBe(false);
  });
});

describe("can() — SITE_MANAGER", () => {
  const user = makeUser("SITE_MANAGER");

  it("can log and void financial records", () => {
    expect(can(user, "create:expense")).toBe(true);
    expect(can(user, "void:expense")).toBe(true);
    expect(can(user, "create:purchase")).toBe(true);
    expect(can(user, "void:purchase")).toBe(true);
    expect(can(user, "view:reports")).toBe(true);
    expect(can(user, "export:csv")).toBe(true);
    expect(can(user, "manage:vendors")).toBe(true);
  });

  it("cannot manage company or employees", () => {
    expect(can(user, "manage:company")).toBe(false);
    expect(can(user, "create:employee")).toBe(false);
    expect(can(user, "topup:wallet")).toBe(false);
    expect(can(user, "super:admin")).toBe(false);
  });
});

describe("can() — SUPERVISOR", () => {
  const user = makeUser("SUPERVISOR");

  it("can create and void expenses and purchases", () => {
    expect(can(user, "create:expense")).toBe(true);
    expect(can(user, "void:expense")).toBe(true);
    expect(can(user, "create:purchase")).toBe(true);
    expect(can(user, "void:purchase")).toBe(true);
    expect(can(user, "view:site")).toBe(true);
  });

  it("cannot access management operations", () => {
    expect(can(user, "topup:wallet")).toBe(false);
    expect(can(user, "create:transfer")).toBe(false);
    expect(can(user, "view:reports")).toBe(false);
    expect(can(user, "export:csv")).toBe(false);
    expect(can(user, "create:income")).toBe(false);
  });

  it("is restricted to assigned sites when siteId + assignedSiteIds are provided", () => {
    const assignedSiteIds = ["site-a", "site-b"];

    expect(can(user, "create:expense", { siteId: "site-a", assignedSiteIds })).toBe(true);
    expect(can(user, "create:expense", { siteId: "site-b", assignedSiteIds })).toBe(true);
    expect(can(user, "create:expense", { siteId: "site-c", assignedSiteIds })).toBe(false);
  });

  it("is not restricted when no site resource context given", () => {
    // No siteId → no site check
    expect(can(user, "create:expense")).toBe(true);
    // siteId provided but no assignedSiteIds → no check (caller didn't supply assignments)
    expect(can(user, "create:expense", { siteId: "site-x" })).toBe(true);
  });
});

describe("can() — WORKER / EMPLOYEE", () => {
  const roles = ["WORKER", "EMPLOYEE"] as const;

  it.each(roles)("%s can only log their own expense and view site", (role) => {
    const user = makeUser(role);
    expect(can(user, "create:expense")).toBe(true);
    expect(can(user, "view:site")).toBe(true);
  });

  it.each(roles)("%s cannot do any management action", (role) => {
    const user = makeUser(role);
    const denied: Action[] = [
      "create:site", "update:site",
      "create:employee", "topup:wallet",
      "void:expense", "create:purchase", "view:reports",
      "super:admin", "manage:company",
    ];
    for (const action of denied) {
      expect(can(user, action), `${role} should NOT be able to ${action}`).toBe(false);
    }
  });
});

// ─── Unknown role ─────────────────────────────────────────────────────────────

describe("can() — unknown role", () => {
  it("denies all actions for an unrecognised role", () => {
    const user = makeUser("GHOST");
    expect(can(user, "create:expense")).toBe(false);
    expect(can(user, "view:site")).toBe(false);
  });
});

// ─── assertCan ────────────────────────────────────────────────────────────────

describe("assertCan()", () => {
  it("does not throw when permitted", () => {
    const owner = makeUser("OWNER");
    expect(() => assertCan(owner, "create:site")).not.toThrow();
  });

  it("throws Forbidden when not permitted", () => {
    const worker = makeUser("WORKER");
    expect(() => assertCan(worker, "create:site")).toThrow("Forbidden");
  });
});
