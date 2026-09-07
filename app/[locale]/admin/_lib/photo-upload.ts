import "server-only";
import { InvariantError, NotFoundError } from "@/lib/dal";

/** Shared validation + error mapping for the admin photo-upload actions. */

const MAX_BYTES = 20 * 1024 * 1024;

export async function readPhoto(
  formData: FormData,
): Promise<Buffer | { error: string }> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image" };
  if (file.size > MAX_BYTES) return { error: "Photo is over 20 MB" };
  return Buffer.from(await file.arrayBuffer());
}

export function photoErrorMessage(err: unknown): string {
  if (err instanceof InvariantError || err instanceof NotFoundError) return err.message;
  const message = String((err as { message?: string })?.message ?? "");
  if (message.toLowerCase().includes("token")) {
    return "Photo storage isn't configured in this environment.";
  }
  return `Upload failed (${(err as { name?: string })?.name ?? "Error"})`;
}
