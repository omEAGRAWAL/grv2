"use server";

import { getCurrentUser } from "@/lib/auth";
import { getUploadSignature, type UploadSignature } from "@/lib/cloudinary";

/**
 * Server action: returns a signed Cloudinary upload signature for bill photos.
 * Requires an authenticated session.
 */
export async function getBillPhotoUploadSignature(): Promise<UploadSignature> {
  await getCurrentUser(); // throws if not authenticated
  return getUploadSignature("bill-photos");
}
