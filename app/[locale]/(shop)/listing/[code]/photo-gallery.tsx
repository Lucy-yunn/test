"use client";

import { useState } from "react";
import Image from "next/image";

export function PhotoGallery({
  photos,
  alt,
}: {
  photos: { url: string; caption: string | null }[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-800">
        No photos
      </div>
    );
  }
  return (
    <div>
      <div className="relative h-72 w-full sm:h-96">
        <Image
          src={photos[active].url}
          alt={photos[active].caption ?? alt}
          fill
          unoptimized
          className="rounded object-contain"
        />
      </div>
      {photos.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p.url}
              onClick={() => setActive(i)}
              className={`relative h-16 w-20 shrink-0 rounded border-2 ${i === active ? "border-purple-600" : "border-transparent"}`}
            >
              <Image src={p.url} alt="" fill unoptimized className="rounded object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
