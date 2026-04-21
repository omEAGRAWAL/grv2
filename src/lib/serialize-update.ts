import type { PhotoItem } from "@/app/actions/site-updates";

export interface SerializedUpdate {
  id: string;
  siteId: string;
  siteName?: string;
  workDone: string;
  headcount: number | null;
  blockers: string | null;
  photos: PhotoItem[];
  submittedById: string;
  submitterName: string;
  submitterTitle: string | null;
  editedAt: Date | null;
  createdAt: Date;
  canEdit: boolean;
  canVoid: boolean;
}

type DbUpdate = {
  id: string;
  siteId: string;
  workDone: string;
  headcount: number | null;
  blockers: string | null;
  photos: unknown;
  submittedById: string;
  submittedBy: { id: string; name: string; title: string | null };
  editedAt: Date | null;
  createdAt: Date;
};

const EDIT_WINDOW_MS = 30 * 60 * 1000;

export function serializeUpdate(
  u: DbUpdate,
  currentUserId: string,
  canVoid: boolean
): SerializedUpdate {
  const withinEditWindow = Date.now() - u.createdAt.getTime() < EDIT_WINDOW_MS;
  return {
    id: u.id,
    siteId: u.siteId,
    workDone: u.workDone,
    headcount: u.headcount,
    blockers: u.blockers,
    photos: Array.isArray(u.photos) ? (u.photos as PhotoItem[]) : [],
    submittedById: u.submittedById,
    submitterName: u.submittedBy.name,
    submitterTitle: u.submittedBy.title,
    editedAt: u.editedAt,
    createdAt: u.createdAt,
    canEdit: u.submittedById === currentUserId && withinEditWindow && !u.editedAt,
    canVoid,
  };
}
