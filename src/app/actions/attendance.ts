"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { getUploadSignature } from "@/lib/cloudinary";

export type AttendanceActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── Signed upload URL for selfie ────────────────────────────────────────────

export async function getAttendanceUploadSignature() {
  await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR", "WORKER", "EMPLOYEE"]);
  return getUploadSignature("attendance_selfies");
}

// ─── Self check-in ────────────────────────────────────────────────────────────

const CheckInSchema = z.object({
  photoUrl: z.string().url(),
  photoPublicId: z.string().min(1),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  locationAccuracy: z.coerce.number().optional(),
  siteId: z.string().optional(),
});

export async function selfCheckIn(
  _prev: AttendanceActionResult | null,
  formData: FormData
): Promise<AttendanceActionResult> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) return { success: false, error: "No company associated" };

  const raw = {
    photoUrl: formData.get("photoUrl"),
    photoPublicId: formData.get("photoPublicId"),
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    locationAccuracy: formData.get("locationAccuracy") || undefined,
    siteId: (formData.get("siteId") as string) || undefined,
  };

  const parsed = CheckInSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const today = todayDate();

  try {
    await db.attendance.create({
      data: {
        companyId,
        userId: user.id,
        markedById: user.id,
        date: today,
        status: "PRESENT",
        method: "SELFIE",
        photoUrl: parsed.data.photoUrl,
        photoPublicId: parsed.data.photoPublicId,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        locationAccuracy: parsed.data.locationAccuracy ?? null,
        siteId: parsed.data.siteId ?? null,
      },
    });
  } catch (e: unknown) {
    if (isUniqueConstraintError(e)) {
      return { success: false, error: "You have already checked in today." };
    }
    return { success: false, error: "Failed to record attendance" };
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Manual attendance by manager ────────────────────────────────────────────

const ManualSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["PRESENT", "HALF_DAY", "ABSENT"]),
  date: z.string().optional(),
  siteId: z.string().optional(),
});

export async function markManualAttendance(
  _prev: AttendanceActionResult | null,
  formData: FormData
): Promise<AttendanceActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company" };

  const raw = {
    userId: formData.get("userId"),
    status: formData.get("status"),
    date: (formData.get("date") as string) || undefined,
    siteId: (formData.get("siteId") as string) || undefined,
  };

  const parsed = ManualSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // ensure target user belongs to same company
  const targetUser = await db.user.findFirst({
    where: { id: parsed.data.userId, companyId },
  });
  if (!targetUser) return { success: false, error: "Employee not found" };

  const date = parsed.data.date ? new Date(parsed.data.date) : todayDate();

  try {
    await db.attendance.upsert({
      where: {
        companyId_userId_date: { companyId, userId: parsed.data.userId, date },
      },
      update: {
        status: parsed.data.status,
        method: "MANUAL",
        markedById: caller.id,
        siteId: parsed.data.siteId ?? null,
      },
      create: {
        companyId,
        userId: parsed.data.userId,
        markedById: caller.id,
        date,
        status: parsed.data.status,
        method: "MANUAL",
        siteId: parsed.data.siteId ?? null,
      },
    });
  } catch {
    return { success: false, error: "Failed to record attendance" };
  }

  revalidatePath("/attendance");
  return { success: true };
}

// ─── Query: today's attendance for caller ────────────────────────────────────

export async function getMyTodayAttendance() {
  const user = await getCurrentUser();
  const companyId = user.effectiveCompanyId ?? user.companyId;
  if (!companyId) return null;

  return db.attendance.findUnique({
    where: {
      companyId_userId_date: { companyId, userId: user.id, date: todayDate() },
    },
  });
}

// ─── Query: company roll-call for today (OWNER/SITE_MANAGER) ─────────────────

export async function getTodayRollCall(companyId: string) {
  const today = todayDate();

  const [employees, records] = await Promise.all([
    db.user.findMany({
      where: {
        companyId,
        isActive: true,
        role: { notIn: ["OWNER", "SUPERADMIN"] },
      },
      select: { id: true, name: true, role: true, title: true },
      orderBy: { name: "asc" },
    }),
    db.attendance.findMany({
      where: { companyId, date: today },
      select: { userId: true, status: true, method: true, photoUrl: true },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.userId, r]));

  return employees.map((emp) => ({
    ...emp,
    attendance: recordMap.get(emp.id) ?? null,
  }));
}

// ─── Query: 7-day history for a user ─────────────────────────────────────────

export async function getRecentAttendance(userId: string, companyId: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  const records = await db.attendance.findMany({
    where: {
      companyId,
      userId,
      date: { gte: days[6], lte: days[0] },
    },
    orderBy: { date: "desc" },
  });

  return records;
}

// ─── Query: monthly history for calendar ─────────────────────────────────────

export async function getMonthAttendance(
  userId: string,
  companyId: string,
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  return db.attendance.findMany({
    where: { companyId, userId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

// ─── Query: monthly summary counts ───────────────────────────────────────────

export async function getMonthSummary(
  userId: string,
  companyId: string,
  year: number,
  month: number
) {
  const records = await getMonthAttendance(userId, companyId, year, month);
  return {
    present: records.filter((r) => r.status === "PRESENT").length,
    halfDay: records.filter((r) => r.status === "HALF_DAY").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isUniqueConstraintError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}
