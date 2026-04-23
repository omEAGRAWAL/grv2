"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBillPhotoUploadSignature } from "@/app/actions/uploads";

type UploadResult = {
  secure_url: string;
  public_id: string;
};

type Props = {
  value: UploadResult | null;
  onChange: (v: UploadResult | null) => void;
};

export function BillPhotoUpload({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const sig = await getBillPhotoUploadSignature();
      const compressed = await compressImage(file);
      const fd = new FormData();

      fd.append("file", compressed, "bill.jpg");
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

      if (!res.ok) {
        throw new Error(data.error?.message ?? "Upload failed");
      }

      onChange({
        secure_url: data.secure_url,
        public_id: data.public_id,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bill photo upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Bill Photo</p>
        <div className="relative inline-block">
          <div className="relative h-24 w-32 overflow-hidden rounded-lg border">
            <Image
              src={value.secure_url}
              alt="Bill photo"
              fill
              className="object-cover"
              sizes="128px"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <input type="hidden" name="billPhotoUrl" value={value.secure_url} />
        <input type="hidden" name="billPhotoPublicId" value={value.public_id} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Bill Photo (optional)</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        className="h-16 w-full gap-2 border-dashed"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {isUploading ? "Uploading bill..." : "Take photo or upload bill"}
        </span>
      </Button>
    </div>
  );
}

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 1280;
      const ratio = Math.min(1, maxWidth / img.width);

      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Compression failed"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Compression failed"));
        },
        "image/jpeg",
        0.7
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
