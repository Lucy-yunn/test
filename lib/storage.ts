import "server-only";
import { put, del, type PutBlobResult } from "@vercel/blob";

/**
 * Thin abstraction over the photo store (ADR-0001). The database stores only the
 * URL + metadata this returns — never the bytes. Only curated, downscaled staff
 * uploads reach the store; raw seller dumps stay in a shared drive.
 *
 * Swapping Vercel Blob for S3/R2 later means reimplementing this file only.
 */
export interface StoredImage {
  url: string;
  pathname: string;
  contentType: string | undefined;
}

export async function uploadImage(
  key: string,
  data: Buffer | Blob | ArrayBuffer,
  contentType?: string,
): Promise<StoredImage> {
  const result: PutBlobResult = await put(key, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return {
    url: result.url,
    pathname: result.pathname,
    contentType: result.contentType,
  };
}

export async function deleteImage(url: string): Promise<void> {
  await del(url);
}
