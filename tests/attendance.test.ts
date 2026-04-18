import { describe, it, expect, vi, beforeEach } from "vitest";
import { selfCheckIn, markManualAttendance } from "@/app/actions/attendance";
import { db } from "@/lib/db";
import { getCurrentUser, requireRole } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
  db: {
    attendance: {
      create: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/cloudinary", () => ({
  getUploadSignature: vi.fn().mockReturnValue({
    signature: "sig",
    timestamp: 1234567890,
    apiKey: "key",
    cloudName: "cloud",
    folder: "attendance_selfies",
    uploadPreset: "constructhub_bills",
  }),
}));

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const mockUser = {
  id: "u1",
  name: "Ramesh",
  role: "WORKER",
  companyId: "co1",
  effectiveCompanyId: "co1",
  username: "ramesh",
  isActive: true,
  joinedAt: new Date(),
  lastLoginAt: null,
  onboardingDismissedAt: null,
};

const mockOwner = {
  id: "owner1",
  role: "OWNER",
  companyId: "co1",
  effectiveCompanyId: "co1",
};

// ─── selfCheckIn ──────────────────────────────────────────────────────────────

describe("selfCheckIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(db.attendance.create).mockResolvedValue({} as any);
  });

  it("creates attendance record on valid selfie check-in", async () => {
    const result = await selfCheckIn(
      null,
      makeForm({
        photoUrl: "https://res.cloudinary.com/c/image/upload/v1/attendance_selfies/selfie.jpg",
        photoPublicId: "attendance_selfies/selfie",
        latitude: "18.9220",
        longitude: "72.8347",
        locationAccuracy: "15",
      })
    );

    expect(result).toEqual({ success: true });
    expect(db.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "co1",
          userId: "u1",
          markedById: "u1",
          status: "PRESENT",
          method: "SELFIE",
        }),
      })
    );
  });

  it("rejects duplicate check-in (unique constraint P2002)", async () => {
    const err = Object.assign(new Error("Unique violation"), { code: "P2002" });
    vi.mocked(db.attendance.create).mockRejectedValue(err);

    const result = await selfCheckIn(
      null,
      makeForm({
        photoUrl: "https://res.cloudinary.com/c/image/upload/v1/attendance_selfies/selfie.jpg",
        photoPublicId: "attendance_selfies/selfie",
      })
    );

    expect(result).toMatchObject({ success: false, error: expect.stringContaining("already") });
  });

  it("stores null coordinates when location is denied (no lat/lng fields)", async () => {
    await selfCheckIn(
      null,
      makeForm({
        photoUrl: "https://res.cloudinary.com/c/image/upload/v1/attendance_selfies/selfie.jpg",
        photoPublicId: "attendance_selfies/selfie",
      })
    );

    expect(db.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ latitude: null, longitude: null }),
      })
    );
  });
});

// ─── markManualAttendance ────────────────────────────────────────────────────

describe("markManualAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(mockOwner as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "u1", companyId: "co1" } as any);
    vi.mocked(db.attendance.upsert).mockResolvedValue({} as any);
  });

  it("marks employee PRESENT with method=MANUAL and markedById=caller", async () => {
    const result = await markManualAttendance(
      null,
      makeForm({ userId: "u1", status: "PRESENT" })
    );

    expect(result).toEqual({ success: true });
    expect(db.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          method: "MANUAL",
          markedById: "owner1",
          status: "PRESENT",
        }),
      })
    );
  });

  it("rejects when caller lacks OWNER or SITE_MANAGER role", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));

    const result = await markManualAttendance(
      null,
      makeForm({ userId: "u1", status: "PRESENT" })
    );

    expect(result).toMatchObject({ success: false, error: "Unauthorized" });
  });

  it("rejects marking employee from a different company", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);

    const result = await markManualAttendance(
      null,
      makeForm({ userId: "u_other_company", status: "PRESENT" })
    );

    expect(result).toMatchObject({ success: false, error: "Employee not found" });
  });
});

// ─── company isolation ────────────────────────────────────────────────────────

describe("attendance company isolation", () => {
  it("selfCheckIn scopes attendance to caller's companyId", async () => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ ...mockUser, companyId: "co2", effectiveCompanyId: "co2" } as any);
    vi.mocked(db.attendance.create).mockResolvedValue({} as any);

    await selfCheckIn(
      null,
      makeForm({
        photoUrl: "https://res.cloudinary.com/c/image/upload/v1/attendance_selfies/selfie.jpg",
        photoPublicId: "attendance_selfies/selfie",
      })
    );

    expect(db.attendance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "co2" }),
      })
    );
  });
});
