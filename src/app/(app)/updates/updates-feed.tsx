"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpdateCard } from "@/components/sites/update-card";
import { fetchCompanyUpdates } from "@/app/actions/site-updates";
import type { SerializedUpdate } from "@/components/sites/update-card";
import type { PhotoItem } from "@/app/actions/site-updates";

// From server we get ISO strings for dates; UpdateCard expects Date objects
interface FeedItem {
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
  editedAt: string | null;
  createdAt: string;
  canEdit: boolean;
  canVoid: boolean;
}

function toSerializedUpdate(item: FeedItem): SerializedUpdate {
  return {
    ...item,
    editedAt: item.editedAt ? new Date(item.editedAt) : null,
    createdAt: new Date(item.createdAt),
  };
}

interface UpdatesFeedProps {
  companyId: string;
  initialUpdates: FeedItem[];
  totalCount: number;
  currentUserId: string;
  sites: { id: string; name: string }[];
}

export function UpdatesFeed({
  companyId,
  initialUpdates,
  totalCount,
  sites,
}: UpdatesFeedProps) {
  const [updates, setUpdates] = useState<FeedItem[]>(initialUpdates);
  const [total, setTotal] = useState(totalCount);
  const [page, setPage] = useState(1);
  const [filterSiteId, setFilterSiteId] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1;
      const result = await fetchCompanyUpdates(companyId, nextPage, filterSiteId || undefined);
      const newItems: FeedItem[] = result.updates.map((u) => ({
        id: u.id,
        siteId: u.siteId,
        siteName: (u as typeof u & { site?: { name: string } }).site?.name,
        workDone: u.workDone,
        headcount: u.headcount,
        blockers: u.blockers,
        photos: Array.isArray(u.photos) ? (u.photos as PhotoItem[]) : [],
        submittedById: u.submittedById,
        submitterName: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.name,
        submitterTitle: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.title,
        editedAt: u.editedAt ? u.editedAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        canEdit: false,
        canVoid: true,
      }));
      setUpdates((prev) => [...prev, ...newItems]);
      setTotal(result.total);
      setPage(nextPage);
    });
  };

  const applyFilter = (siteId: string) => {
    setFilterSiteId(siteId);
    startTransition(async () => {
      const result = await fetchCompanyUpdates(companyId, 1, siteId || undefined);
      const items: FeedItem[] = result.updates.map((u) => ({
        id: u.id,
        siteId: u.siteId,
        siteName: (u as typeof u & { site?: { name: string } }).site?.name,
        workDone: u.workDone,
        headcount: u.headcount,
        blockers: u.blockers,
        photos: Array.isArray(u.photos) ? (u.photos as PhotoItem[]) : [],
        submittedById: u.submittedById,
        submitterName: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.name,
        submitterTitle: (u as typeof u & { submittedBy: { name: string; title: string | null } }).submittedBy.title,
        editedAt: u.editedAt ? u.editedAt.toISOString() : null,
        createdAt: u.createdAt.toISOString(),
        canEdit: false,
        canVoid: true,
      }));
      setUpdates(items);
      setTotal(result.total);
      setPage(1);
    });
  };

  const handleVoided = (id: string) => {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    setTotal((t) => t - 1);
  };

  const hasMore = updates.length < total;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filterSiteId}
          onChange={(e) => applyFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        >
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground ml-auto">
          {total} update{total !== 1 ? "s" : ""}
        </p>
      </div>

      {updates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <UpdateCard
              key={u.id}
              update={toSerializedUpdate(u)}
              onVoided={handleVoided}
              onEdited={() => {}}
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
