"use client";

import Image from "next/image";
import { Camera, X } from "lucide-react";
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
  async function handleClick() {
    // Dynamically import CldUploadWidget to avoid SSR issues
    const { CldUploadWidget } = await import("next-cloudinary");
    // We trigger via programmatic open — but since CldUploadWidget is a
    // render-prop component we handle it inline. Instead, use the
    // underlying cloudinary upload widget directly.

    // Get a signed upload signature from the server
    let sig;
    try {
      sig = await getBillPhotoUploadSignature();
    } catch {
      return;
    }

    if (typeof window === "undefined") return;

    // Open Cloudinary Upload Widget
    const widget = (window as any).cloudinary?.createUploadWidget(
      {
        cloudName: sig.cloudName,
        apiKey: sig.apiKey,
        uploadSignature: sig.signature,
        uploadSignatureTimestamp: sig.timestamp,
        folder: sig.folder,
        uploadPreset: sig.uploadPreset,
        sources: ["local", "camera"],
        resourceType: "image",
        maxFileSize: 5_000_000,
        // Open camera on mobile
        showPoweredBy: false,
        styles: { palette: { action: "#18181b" } },
      },
      (error: unknown, result: { event: string; info: UploadResult }) => {
        if (error) return;
        if (result.event === "success") {
          onChange({
            secure_url: result.info.secure_url,
            public_id: result.info.public_id,
          });
          widget.close();
        }
      }
    );
    widget?.open();
  }

  if (value) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Bill Photo</p>
        <div className="relative inline-block">
          <div className="relative w-32 h-24 rounded-lg overflow-hidden border">
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
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
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
      <Button
        type="button"
        variant="outline"
        className="w-full h-16 border-dashed gap-2"
        onClick={handleClick}
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Take photo or upload bill</span>
      </Button>
    </div>
  );
}
