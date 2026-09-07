import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in a parent dir otherwise confuses
  // Turbopack's root inference.
  turbopack: { root: path.resolve() },
  // Portable by construction (ADR-0001): standard Node output, no Vercel-only APIs.
  output: "standalone",
  images: {
    // Curated listing photos are served from Vercel Blob (ADR-0001). The exact
    // hostname is set once the store exists — see .env.example / docs/spec/seed-data.md.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
