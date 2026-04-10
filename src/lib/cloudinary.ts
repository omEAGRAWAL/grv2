import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const UPLOAD_PRESET = "constructhub_bills";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset: string;
}

/**
 * Generate a signed upload signature for client-side Cloudinary uploads.
 * Restricts to: a specific folder, images only, max 5 MB, and the
 * "constructhub_bills" upload preset.
 */
export function getUploadSignature(folder: string): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
    upload_preset: UPLOAD_PRESET,
    resource_type: "image",
    max_bytes: MAX_BYTES,
  };

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
    uploadPreset: UPLOAD_PRESET,
  };
}

/**
 * Permanently delete an asset from Cloudinary by its public_id.
 * Used when voiding a transaction that had a bill photo.
 */
export async function deleteAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
