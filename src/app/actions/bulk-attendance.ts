"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export type BulkAttendanceResult =
  | {
      success: true;
      created: number;
      updated: number;
      skipped: { userName: string; reason: string }[];
    }
  | { success: false; error: string };

const EntrySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["PRESENT", "HALF_DAY", "ABSENT", "SKIP"]),
});

const BulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  entries: z.array(EntrySchema).min(1, "No entries provided"),
});

export async function createBulkAttendance(
  date: string,
  entries: { userId: string; status: "PRESENT" | "HALF_DAY" | "ABSENT" | "SKIP" }[]
): Promise<BulkAttendanceResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return { success: false, error: "No company" };

  const parsed = BulkSchema.safeParse({ date, entries });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Parse YYYY-MM-DD as local midnight to avoid UTC timezone shift issues
  const [y, m, d] = parsed.data.date.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);
  const now = new Date();

  // Reject future dates
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (targetDate > todayMidnight) {
    return { success: false, error: "Cannot mark attendance for future dates" };
  }

  // Reject dates older than 30 days
  const thirtyDaysAgo = new Date(todayMidnight);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (targetDate < thirtyDaysAgo) {
    return { success: false, error: "Cannot mark attendance more than 30 days in the past" };
  }

  // Filter out SKIP entries
  const activeEntries = parsed.data.entries.filter((e) => e.status !== "SKIP");
  if (activeEntries.length === 0) {
    return { success: true, created: 0, updated: 0, skipped: [] };
  }

  // Verify all users belong to this company
  const userIds = activeEntries.map((e) => e.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds }, companyId },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const foreignUsers = userIds.filter((id) => !userMap.has(id));
  if (foreignUsers.length > 0) {
    return { success: false, error: "Some employees do not belong to this company" };
  }

  // Fetch existing attendance records for target date
  const existing = await db.attendance.findMany({
    where: { companyId, date: targetDate, userId: { in: userIds } },
    select: { userId: true, method: true },
  });
  const existingMap = new Map(existing.map((a) => [a.userId, a.method]));

  const skipped: { userName: string; reason: string }[] = [];
  const toCreate: typeof activeEntries = [];
  const toUpdate: typeof activeEntries = [];

  for (const entry of activeEntries) {
    const existingMethod = existingMap.get(entry.userId);
    if (!existingMethod) {
      toCreate.push(entry);
    } else if (existingMethod === "SELFIE") {
      // Never overwrite selfie check-ins
      skipped.push({
        userName: userMap.get(entry.userId) ?? entry.userId,
        reason: "Already checked in via selfie",
      });
    } else {
      // MANUAL → update
      toUpdate.push(entry);
    }
  }

  try {
    await db.$transaction(async (tx) => {
      for (const entry of toCreate) {
        await tx.attendance.create({
          data: {
            companyId,
            userId: entry.userId,
            markedById: caller.id,
            date: targetDate,
            status: entry.status as "PRESENT" | "HALF_DAY" | "ABSENT",
            method: "MANUAL",
          },
        });
      }

      for (const entry of toUpdate) {
        await tx.attendance.update({
          where: {
            companyId_userId_date: { companyId, userId: entry.userId, date: targetDate },
          },
          data: {
            status: entry.status as "PRESENT" | "HALF_DAY" | "ABSENT",
            method: "MANUAL",
            markedById: caller.id,
          },
        });
      }
    });
  } catch (err) {
    console.error("[createBulkAttendance] DB error:", err);
    return { success: false, error: "Failed to save attendance records" };
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");

  return {
    success: true,
    created: toCreate.length,
    updated: toUpdate.length,
    skipped,
  };
}
