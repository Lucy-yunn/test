import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { downscaleForWeb, MAX_EDGE } from "./images";

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#4477aa" },
  })
    .png()
    .toBuffer();
}

describe("downscaleForWeb", () => {
  it("shrinks the longest edge to MAX_EDGE and keeps the aspect ratio", async () => {
    const out = await downscaleForWeb(await png(4000, 3000));
    expect(Math.max(out.width, out.height)).toBe(MAX_EDGE);
    expect(out.width / out.height).toBeCloseTo(4 / 3, 1);
    expect(out.contentType).toBe("image/jpeg");
  });

  it("does not enlarge a small image", async () => {
    const out = await downscaleForWeb(await png(600, 400));
    expect(out.width).toBe(600);
    expect(out.height).toBe(400);
  });

  it("re-encodes PNG input to JPEG", async () => {
    const out = await downscaleForWeb(await png(1200, 800));
    // JPEG SOI marker
    expect(out.data[0]).toBe(0xff);
    expect(out.data[1]).toBe(0xd8);
  });

  it("rejects a non-image buffer", async () => {
    await expect(downscaleForWeb(Buffer.from("not an image"))).rejects.toThrow();
  });
});
