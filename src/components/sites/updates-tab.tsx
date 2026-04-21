"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostUpdateDialog } from "./post-update-dialog";
import { UpdateCard } from "./update-card";
import { fetchSiteUpdates } from "@/app/actions/site-updates";
import { serializeUpdate } from "@/lib/serialize-update";
import type { SerializedUpdate } from "@/lib/serialize-update";

interface UpdatesTabProps {
  siteId: string;
  initialUpdates: SerializedUpdate[];
  totalCount: number;
  canPost: boolean;
  currentUserId: string;
  canVoid: boolean;
}

const PAGE_SIZE = 20;

export function UpdatesTab({
  siteId,
  initialUpdates,
  totalCount,
  canPost,
  currentUserId,
  canVoid,
}: UpdatesTabProps) {
  const [updates, setUpdates] = useState<SerializedUpdate[]>(initialUpdates);
  const [total, setTotal] = useState(totalCount);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await fetchSiteUpdates(siteId, nextPage);
      const newUpdates = result.updates.map((u) =>
        serializeUpdate(u, currentUserId, canVoid)
      );
      setUpdates((prev) => [...prev, ...newUpdates]);
      setTotal(result.total);
      setPage(nextPage);
    });
  };

  const handleVoided = (id: string) => {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    setTotal((t) => t - 1);
  };

  // Refresh a specific update after edit (simplest: reload from server action)
  const handleEdited = (_id: string) => {
    startTransition(async () => {
      const result = await fetchSiteUpdates(siteId, 1);
      const refreshed = result.updates.map((u) =>
        serializeUpdate(u, currentUserId, canVoid)
      );
      setUpdates(refreshed);
      setTotal(result.total);
      setPage(1);
    });
  };

  const hasMore = updates.length < total;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} update{total !== 1 ? "s" : ""}
        </p>
        {canPost && (
          <PostUpdateDialog
            siteId={siteId}
            onSuccess={() => {
              startTransition(async () => {
                const result = await fetchSiteUpdates(siteId, 1);
                setUpdates(result.updates.map((u) => serializeUpdate(u, currentUserId, canVoid)));
                setTotal(result.total);
                setPage(1);
              });
            }}
          />
        )}
      </div>

      {updates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No updates yet.</p>
          {canPost && (
            <p className="text-xs text-muted-foreground mt-1">
              Post the first update for this site.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <UpdateCard
              key={u.id}
              update={u}
              onVoided={handleVoided}
              onEdited={handleEdited}
            />
          ))}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={loadMore}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Load more (${total - updates.length} remaining)`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Serialize DB row → SerializedUpdate ──────────────────────────────────────

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

export function serializeUpdate(
  u: DbUpdate,
  currentUserId: string,
  canVoid: boolean
): SerializedUpdate {
  const EDIT_WINDOW_MS = 30 * 60 * 1000;
  const withinEditWindow = Date.now() - u.createdAt.getTime() < EDIT_WINDOW_MS;
  return {
    id: u.id,
    siteId: u.siteId,
    workDone: u.workDone,
    headcount: u.headcount,
    blockers: u.blockers,
    photos: Array.isArray(u.photos) ? (u.photos as { url: string; publicId: string }[]) : [],
    submittedById: u.submittedById,
    submitterName: u.submittedBy.name,
    submitterTitle: u.submittedBy.title,
    editedAt: u.editedAt,
    createdAt: u.createdAt,
    canEdit: u.submittedById === currentUserId && withinEditWindow && !u.editedAt,
    canVoid,
  };
}
