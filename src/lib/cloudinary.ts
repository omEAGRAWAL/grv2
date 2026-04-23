import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function getConfiguredUploadPreset(): string | null {
  const preset =
    process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() ||
    "";

  return preset || null;
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset: string | null;
}

/**
 * Generate a signed upload signature for client-side Cloudinary uploads.
 * Restricts to: a specific folder.
 * If an upload preset is configured, include it in the signed params.
 */
export function getUploadSignature(folder: string): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const uploadPreset = getConfiguredUploadPreset();

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };
  if (uploadPreset) {
    paramsToSign.upload_preset = uploadPreset;
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder,
    uploadPreset,
  };
}

/**
 * Permanently delete an asset from Cloudinary by its public_id.
 * Used when voiding a transaction that had a bill photo.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
