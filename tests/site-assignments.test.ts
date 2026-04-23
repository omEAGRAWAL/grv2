import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignSupervisor, unassignSupervisor } from "@/app/actions/site-assignments";
import { getSites } from "@/lib/sites";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

vi.mock("@/lib/db", () => {
  const mockDb = {
    site: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findFirst: vi.fn(), findMany: vi.fn() },
    siteAssignment: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  };
  return { db: mockDb, getUnscopedDb: () => mockDb, getCompanyScopedDb: () => mockDb };
});

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const mockOwner = {
  id: "owner1",
  role: "OWNER",
  companyId: "co1",
  effectiveCompanyId: "co1",
};

describe("assignSupervisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(mockOwner as any);
    vi.mocked(db.site.findFirst).mockResolvedValue({ id: "site1", companyId: "co1" } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "u1",
      companyId: "co1",
      role: "SUPERVISOR",
    } as any);
    vi.mocked(db.siteAssignment.upsert).mockResolvedValue({} as any);
  });

  it("assigns a supervisor successfully", async () => {
    const result = await assignSupervisor(null, makeForm({ siteId: "site1", userId: "u1" }));
    expect(result).toEqual({ success: true });
    expect(db.siteAssignment.upsert).toHaveBeenCalled();
  });

  it("rejects when site not found in company", async () => {
    vi.mocked(db.site.findFirst).mockResolvedValue(null);
    const result = await assignSupervisor(null, makeForm({ siteId: "site1", userId: "u1" }));
    expect(result).toMatchObject({ success: false, error: "Site not found" });
  });

  it("rejects assigning a non-supervisor user", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: "u2",
      companyId: "co1",
      role: "EMPLOYEE",
    } as any);
    const result = await assignSupervisor(null, makeForm({ siteId: "site1", userId: "u2" }));
    expect(result).toMatchObject({ success: false });
  });

  it("returns unauthorized when caller lacks role", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    const result = await assignSupervisor(null, makeForm({ siteId: "site1", userId: "u1" }));
    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
  });
});

describe("unassignSupervisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(mockOwner as any);
    vi.mocked(db.siteAssignment.deleteMany).mockResolvedValue({ count: 1 } as any);
  });

  it("removes the assignment", async () => {
    const result = await unassignSupervisor("site1", "u1");
    expect(result).toEqual({ success: true });
    expect(db.siteAssignment.deleteMany).toHaveBeenCalledWith({
      where: { siteId: "site1", userId: "u1" },
    });
  });

  it("returns unauthorized when caller lacks role", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    const result = await unassignSupervisor("site1", "u1");
    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
  });
});

describe("getSites with SUPERVISOR filtering", () => {
  const fakeSites = [
    { id: "site1", name: "Alpha", status: "ACTIVE" },
    { id: "site2", name: "Beta", status: "ACTIVE" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.siteAssignment.findMany).mockResolvedValue([
      { siteId: "site1" },
    ] as any);
    vi.mocked(db.site.findMany).mockResolvedValue([fakeSites[0]] as any);
  });

  it("filters to assigned sites for SUPERVISOR role", async () => {
    const sites = await getSites({ role: "SUPERVISOR", userId: "u1" });
    expect(db.siteAssignment.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { siteId: true },
    });
    expect(db.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["site1"] } }),
      })
    );
    expect(sites).toHaveLength(1);
    expect(sites[0].id).toBe("site1");
  });

  it("fetches all sites for OWNER role", async () => {
    vi.mocked(db.site.findMany).mockResolvedValue(fakeSites as any);
    await getSites({ role: "OWNER", userId: "owner1" });
    expect(db.siteAssignment.findMany).not.toHaveBeenCalled();
    expect(db.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("applies status filter for SUPERVISOR", async () => {
    await getSites({ role: "SUPERVISOR", userId: "u1", status: "ACTIVE" });
    expect(db.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });
});
