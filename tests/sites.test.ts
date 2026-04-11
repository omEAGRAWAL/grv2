import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSite } from "@/app/actions/sites";
import { getSites } from "@/lib/sites";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    site: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockOwner = { id: "owner1", role: "OWNER", name: "Owner" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOwner).mockResolvedValue(mockOwner as any);
  vi.mocked(db.site.create).mockResolvedValue({} as any);
});

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validSiteData = {
  name: "Site Alpha",
  location: "Mumbai, Maharashtra",
  clientName: "ACME Corp",
  contractValue: "5000000",
  startDate: "2024-01-15",
  status: "ACTIVE",
};

// ─── createSite action ────────────────────────────────────────────────────────

describe("createSite", () => {
  it("succeeds with valid data and stores paise correctly", async () => {
    const result = await createSite(null, makeForm(validSiteData));

    expect(result.success).toBe(true);
    expect(vi.mocked(db.site.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Site Alpha",
        location: "Mumbai, Maharashtra",
        clientName: "ACME Corp",
        contractValuePaise: 500000000n, // ₹50,00,000 = 500000000 paise
        status: "ACTIVE",
      }),
    });
  });

  it("parses contract value with decimal correctly", async () => {
    const result = await createSite(
      null,
      makeForm({ ...validSiteData, contractValue: "1234.56" })
    );

    expect(result.success).toBe(true);
    expect(vi.mocked(db.site.create)).toHaveBeenCalledWith({
      data: expect.objectContaining({ contractValuePaise: 123456n }),
    });
  });

  it("fails with negative contract value", async () => {
    const result = await createSite(
      null,
      makeForm({ ...validSiteData, contractValue: "-100" })
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /non-negative/i
    );
    expect(vi.mocked(db.site.create)).not.toHaveBeenCalled();
  });

  it("fails with missing required field (name)", async () => {
    // FormData.get returns null for absent fields; Zod rejects null for string
    const { name: _n, ...withoutName } = validSiteData;
    const result = await createSite(null, makeForm(withoutName));

    expect(result.success).toBe(false);
    expect(vi.mocked(db.site.create)).not.toHaveBeenCalled();
  });

  it("fails with missing start date", async () => {
    const { startDate: _s, ...withoutDate } = validSiteData;
    const result = await createSite(null, makeForm(withoutDate));

    expect(result.success).toBe(false);
  });

  it("fails when called by non-owner", async () => {
    vi.mocked(requireOwner).mockRejectedValue(new Error("Forbidden"));

    const result = await createSite(null, makeForm(validSiteData));

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /unauthorized/i
    );
  });
});

// ─── getSites helper ──────────────────────────────────────────────────────────

describe("getSites", () => {
  const fakeSites = [
    { id: "s1", name: "Site A", status: "ACTIVE", createdAt: new Date("2024-02-01") },
    { id: "s2", name: "Site B", status: "COMPLETED", createdAt: new Date("2024-01-01") },
  ];

  it("fetches all sites sorted by newest first", async () => {
    vi.mocked(db.site.findMany).mockResolvedValue(fakeSites as any);

    const sites = await getSites();
    expect(vi.mocked(db.site.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
    expect(sites).toEqual(fakeSites);
  });

  it("filters by status when provided", async () => {
    vi.mocked(db.site.findMany).mockResolvedValue([fakeSites[0]] as any);

    await getSites("ACTIVE");
    expect(vi.mocked(db.site.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("ignores invalid status values and fetches all", async () => {
    vi.mocked(db.site.findMany).mockResolvedValue(fakeSites as any);

    await getSites("INVALID_STATUS");
    expect(vi.mocked(db.site.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });
});
