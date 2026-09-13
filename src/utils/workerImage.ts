const cloudinary = require("./cloudinary");

/** Shared default asset from setWorkerDefImage.ts — never destroy this. */
export const WORKER_SHARED_DEFAULT_PUBLIC_IDS = new Set([
  "workers/def_img",
  "Workers/workers/def_img",
  "Workers/def_img",
]);

export function isSharedWorkerDefaultPublicId(
  publicId?: string | null,
): boolean {
  if (!publicId) return false;
  return WORKER_SHARED_DEFAULT_PUBLIC_IDS.has(publicId);
}

/** Destroy a worker Cloudinary asset unless it is the shared default. */
export async function safeDestroyWorkerImage(
  publicId?: string | null,
): Promise<void> {
  if (!publicId || isSharedWorkerDefaultPublicId(publicId)) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.log("Error deleting worker image from Cloudinary:", err);
  }
}
