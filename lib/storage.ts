import "server-only";
import { put, del } from "@vercel/blob";
import type { PhotoStore } from "./services/photos";

/**
 * Vercel Blob — the concrete photo store (ADR-0001). The database stores only
 * the URL this returns, never the bytes. Swapping for S3/R2 later means
 * reimplementing this file only. `BLOB_READ_WRITE_TOKEN` is injected by Vercel.
 */
export const blobPhotoStore: PhotoStore = {
  async upload(key, data, contentType) {
    const result = await put(key, data, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: result.url };
  },
  async delete(url) {
    await del(url);
  },
};
