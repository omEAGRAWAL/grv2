"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/auth";
import { getUploadSignature } from "@/lib/cloudinary";

export type UpdateActionResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type PhotoItem = { url: string; publicId: string };

// ─── Upload signature ─────────────────────────────────────────────────────────

export async function getSiteUpdateUploadSignature() {
  await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR"]);
  return getUploadSignature("site_updates");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function canPostToSite(
  caller: { id: string; role: string; companyId: string | null; effectiveCompanyId?: string },
  siteId: string
): Promise<boolean> {
  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (!companyId) return false;
  if (["OWNER", "SITE_MANAGER"].includes(caller.role)) return true;
  if (caller.role === "SUPERVISOR") {
    const assignment = await db.siteAssignment.findFirst({
      where: { userId: caller.id, siteId },
    });
    return assignment !== null;
  }
  return false;
}

// ─── Create ───────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  siteId: z.string().min(1),
  workDone: z.string().min(1, "Work done is required").max(500),
  headcount: z.coerce.number().int().positive().optional(),
  blockers: z.string().max(500).optional(),
  photos: z.string().optional(), // JSON string of PhotoItem[]
});

export async function createSiteUpdate(
  _prev: UpdateActionResult | null,
  formData: FormData
): Promise<UpdateActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER", "SUPERVISOR"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    siteId: formData.get("siteId"),
    workDone: formData.get("workDone"),
    headcount: formData.get("headcount") || undefined,
    blockers: (formData.get("blockers") as string) || undefined,
    photos: (formData.get("photos") as string) || undefined,
  };

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!(await canPostToSite(caller, parsed.data.siteId))) {
    return { success: false, error: "You are not assigned to this site" };
  }

  let photos: PhotoItem[] = [];
  if (parsed.data.photos) {
    try {
      photos = JSON.parse(parsed.data.photos);
      if (!Array.isArray(photos) || photos.length > 5) {
        return { success: false, error: "Maximum 5 photos allowed" };
      }
    } catch {
      return { success: false, error: "Invalid photos data" };
    }
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId!;

  try {
    const update = await db.siteUpdate.create({
      data: {
        companyId,
        siteId: parsed.data.siteId,
        workDone: parsed.data.workDone,
        headcount: parsed.data.headcount ?? null,
        blockers: parsed.data.blockers ?? null,
        photos,
        submittedById: caller.id,
      },
    });
    revalidatePath(`/sites/${parsed.data.siteId}`);
    revalidatePath("/updates");
    revalidatePath("/dashboard");
    return { success: true, id: update.id };
  } catch {
    return { success: false, error: "Failed to post update" };
  }
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

const EditSchema = z.object({
  updateId: z.string().min(1),
  workDone: z.string().min(1, "Work done is required").max(500),
  headcount: z.coerce.number().int().positive().optional(),
  blockers: z.string().max(500).optional(),
  photos: z.string().optional(),
});

const EDIT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export async function editSiteUpdate(
  _prev: UpdateActionResult | null,
  formData: FormData
): Promise<UpdateActionResult> {
  let caller;
  try {
    caller = await getCurrentUser();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const raw = {
    updateId: formData.get("updateId"),
    workDone: formData.get("workDone"),
    headcount: formData.get("headcount") || undefined,
    blockers: (formData.get("blockers") as string) || undefined,
    photos: (formData.get("photos") as string) || undefined,
  };

  const parsed = EditSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await db.siteUpdate.findUnique({
    where: { id: parsed.data.updateId },
  });
  if (!existing || existing.voidedAt) {
    return { success: false, error: "Update not found" };
  }
  if (existing.submittedById !== caller.id) {
    return { success: false, error: "Only the original submitter can edit" };
  }
  if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
    return { success: false, error: "Edit window has closed (30 minutes)" };
  }

  let photos: PhotoItem[] = existing.photos as PhotoItem[];
  if (parsed.data.photos) {
    try {
      photos = JSON.parse(parsed.data.photos);
      if (!Array.isArray(photos) || photos.length > 5) {
        return { success: false, error: "Maximum 5 photos allowed" };
      }
    } catch {
      return { success: false, error: "Invalid photos data" };
    }
  }

  try {
    await db.siteUpdate.update({
      where: { id: parsed.data.updateId },
      data: {
        workDone: parsed.data.workDone,
        headcount: parsed.data.headcount ?? null,
        blockers: parsed.data.blockers ?? null,
        photos,
        editedAt: new Date(),
      },
    });
    revalidatePath(`/sites/${existing.siteId}`);
    revalidatePath("/updates");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to edit update" };
  }
}

// ─── Void ─────────────────────────────────────────────────────────────────────

export async function voidSiteUpdate(updateId: string): Promise<UpdateActionResult> {
  let caller;
  try {
    caller = await requireRole(["OWNER", "SITE_MANAGER"]);
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const existing = await db.siteUpdate.findUnique({
    where: { id: updateId },
  });
  if (!existing || existing.voidedAt) {
    return { success: false, error: "Update not found" };
  }

  const companyId = caller.effectiveCompanyId ?? caller.companyId;
  if (existing.companyId !== companyId) {
    return { success: false, error: "Not in your company" };
  }

  try {
    await db.siteUpdate.update({
      where: { id: updateId },
      data: { voidedAt: new Date(), voidedById: caller.id },
    });
    revalidatePath(`/sites/${existing.siteId}`);
    revalidatePath("/updates");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to void update" };
  }
}

// ─── Fetch (server action for "load more") ────────────────────────────────────

export async function fetchSiteUpdates(siteId: string, page: number) {
  const PAGE_SIZE = 20;
  const updates = await db.siteUpdate.findMany({
    where: { siteId, voidedAt: null },
    include: { submittedBy: { select: { id: true, name: true, title: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await db.siteUpdate.count({ where: { siteId, voidedAt: null } });
  return { updates, total, page, pageSize: PAGE_SIZE };
}

// ─── Cross-site feed ──────────────────────────────────────────────────────────

export async function fetchCompanyUpdates(companyId: string, page: number, siteId?: string) {
  const PAGE_SIZE = 20;
  const where = {
    companyId,
    voidedAt: null as null,
    ...(siteId ? { siteId } : {}),
  };
  const [updates, total] = await Promise.all([
    db.siteUpdate.findMany({
      where,
      include: {
        submittedBy: { select: { id: true, name: true, title: true } },
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.siteUpdate.count({ where }),
  ]);
  return { updates, total, page, pageSize: PAGE_SIZE };
}
