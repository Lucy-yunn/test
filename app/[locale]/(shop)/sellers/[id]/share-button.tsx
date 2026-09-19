"use client";

import { useState } from "react";

/** Copies the current page address. No server involvement. */
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: nothing to do, the address bar still has the link.
        }
      }}
      className="rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
