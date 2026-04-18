"use client";

import { useState, useTransition } from "react";
import { Users, AlertTriangle, Clock, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { voidSiteUpdate } from "@/app/actions/site-updates";
import { PostUpdateDialog } from "./post-update-dialog";
import type { PhotoItem } from "@/app/actions/site-updates";

export interface SerializedUpdate {
  id: string;
  siteId: string;
  siteName?: string;   // present in cross-site feed
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

// ─── Photo lightbox ───────────────────────────────────────────────────────────

function PhotoLightbox({ photos }: { photos: PhotoItem[] }) {
  const [selected, setSelected] = useState<PhotoItem | null>(null);

  if (!photos.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {photos.map((p, i) => (
          <button key={p.publicId} onClick={() => setSelected(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={`photo ${i + 1}`}
              className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
      </div>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg p-2">
          <DialogHeader className="px-2 pt-2">
            <DialogTitle className="text-sm">Photo</DialogTitle>
          </DialogHeader>
          {selected && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.url}
              alt="Site update photo"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Void confirm dialog ──────────────────────────────────────────────────────

function VoidButton({ updateId, onVoided }: { updateId: string; onVoided: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleVoid = () => {
    startTransition(async () => {
      const result = await voidSiteUpdate(updateId);
      if (result.success) {
        toast.success("Update voided");
        setOpen(false);
        onVoided();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
          <Trash2 className="h-3 w-3 mr-1" /> Void
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Void this update?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The update will be hidden from the timeline. This cannot be undone.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleVoid}
            disabled={isPending}
          >
            {isPending ? "Voiding…" : "Void"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function RelativeTime({ date }: { date: Date }) {
  const d = new Date(date); // ensure it's a Date object
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let relative: string;
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (hours < 24) relative = `${hours}h ago`;
  else relative = `${days}d ago`;

  const absolute = d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <span title={absolute} className="text-xs text-muted-foreground cursor-help">
      {relative}
    </span>
  );
}

// ─── Update card ──────────────────────────────────────────────────────────────

interface UpdateCardProps {
  update: SerializedUpdate;
  onVoided: (id: string) => void;
  onEdited: (id: string) => void;
}

export function UpdateCard({ update, onVoided, onEdited }: UpdateCardProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-background">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {update.siteName && (
            <p className="text-xs font-medium text-primary mb-0.5">{update.siteName}</p>
          )}
          <p className="text-sm font-medium truncate">{update.submitterName}</p>
          {update.submitterTitle && (
            <p className="text-xs text-muted-foreground">{update.submitterTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <RelativeTime date={update.createdAt} />
          {update.editedAt && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">edited</Badge>
          )}
        </div>
      </div>

      {/* Work done */}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{update.workDone}</p>

      {/* Headcount badge */}
      {update.headcount && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{update.headcount} on site</span>
        </div>
      )}

      {/* Blockers */}
      {update.blockers && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 whitespace-pre-wrap">{update.blockers}</p>
        </div>
      )}

      {/* Photos */}
      <PhotoLightbox photos={update.photos} />

      {/* Actions */}
      {(update.canEdit || update.canVoid) && (
        <div className="flex items-center gap-1 pt-1 border-t">
          {update.canEdit && (
            <PostUpdateDialog
              siteId={update.siteId}
              trigger={
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              }
              existing={{
                id: update.id,
                workDone: update.workDone,
                headcount: update.headcount,
                blockers: update.blockers,
                photos: update.photos,
              }}
              onSuccess={() => onEdited(update.id)}
            />
          )}
          {update.canVoid && (
            <VoidButton updateId={update.id} onVoided={() => onVoided(update.id)} />
          )}
        </div>
      )}
    </div>
  );
}
