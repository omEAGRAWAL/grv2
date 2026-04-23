"use client";

import { useRef, useState, useActionState, useEffect, useTransition } from "react";
import { X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FormDialog } from "@/components/form-dialog";
import {
  createSiteUpdate,
  editSiteUpdate,
  getSiteUpdateUploadSignature,
} from "@/app/actions/site-updates";
import type { UpdateActionResult, PhotoItem } from "@/app/actions/site-updates";

interface ExistingUpdate {
  id: string;
  workDone: string;
  headcount: number | null;
  blockers: string | null;
  photos: PhotoItem[];
}

interface PostUpdateFormProps {
  siteId: string;
  close: () => void;
  existing?: ExistingUpdate;
  onSuccess?: () => void;
}

function PostUpdateForm({ siteId, close, existing, onSuccess }: PostUpdateFormProps) {
  const action = existing ? editSiteUpdate : createSiteUpdate;
  const [state, formAction] = useActionState<UpdateActionResult | null, FormData>(action, null);
  const [isPending, startTransition] = useTransition();
  const [photos, setPhotos] = useState<PhotoItem[]>(existing?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(existing ? "Update saved" : "Update posted");
      onSuccess?.();
      close();
    }
  }, [state, close, existing, onSuccess]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photos.length + files.length > 5) {
      toast.error("Maximum 5 photos");
      return;
    }
    setUploading(true);
    try {
      const sig = await getSiteUpdateUploadSignature();
      for (const file of files) {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("file", compressed, "photo.jpg");
        fd.append("api_key", sig.apiKey);
        fd.append("timestamp", String(sig.timestamp));
        fd.append("signature", sig.signature);
        fd.append("folder", sig.folder);
        if (sig.uploadPreset) {
          fd.append("upload_preset", sig.uploadPreset);
        }
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body: fd }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message ?? "Upload failed");
        setPhotos((prev) => [...prev, { url: data.secure_url, publicId: data.public_id }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (existing) fd.append("updateId", existing.id);
    fd.append("photos", JSON.stringify(photos));
    startTransition(() => formAction(fd));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <input type="hidden" name="siteId" value={siteId} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium">What happened / work done *</label>
        <Textarea
          name="workDone"
          rows={4}
          maxLength={500}
          defaultValue={existing?.workDone}
          placeholder="Describe what was done or happened at the site…"
          required
          className="resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Headcount (optional)</label>
          <input
            type="number"
            name="headcount"
            min={1}
            defaultValue={existing?.headcount ?? ""}
            placeholder="e.g. 12"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Blockers / issues (optional)</label>
        <Textarea
          name="blockers"
          rows={2}
          maxLength={500}
          defaultValue={existing?.blockers ?? ""}
          placeholder="Any problems, delays, or issues?"
          className="resize-none"
        />
      </div>

      {/* Photo upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Photos ({photos.length}/5)</label>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={p.publicId} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`photo ${i + 1}`}
                className="h-16 w-16 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-16 w-16 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-xs">…</span>
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={handlePhotoSelect}
        />
      </div>

      {state && !state.success && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={close}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isPending || uploading}
        >
          {isPending ? "Posting…" : existing ? "Save changes" : "Post update"}
        </Button>
      </div>
    </form>
  );
}

interface PostUpdateDialogProps {
  siteId: string;
  trigger?: React.ReactNode;
  existing?: ExistingUpdate;
  onSuccess?: () => void;
}

export function PostUpdateDialog({
  siteId,
  trigger,
  existing,
  onSuccess,
}: PostUpdateDialogProps) {
  const defaultTrigger = (
    <Button size="sm">+ Post Update</Button>
  );

  return (
    <FormDialog
      trigger={trigger ?? defaultTrigger}
      title={existing ? "Edit update" : "Post site update"}
    >
      {({ close }) => (
        <PostUpdateForm
          siteId={siteId}
          close={close}
          existing={existing}
          onSuccess={onSuccess}
        />
      )}
    </FormDialog>
  );
}

// ─── Image compression helper ─────────────────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_WIDTH = 1280;
      const ratio = Math.min(1, MAX_WIDTH / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/jpeg",
        0.7
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
