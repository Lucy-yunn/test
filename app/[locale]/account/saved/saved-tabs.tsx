"use client";

import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/account/saved/parts", label: "Saved Parts" },
  { href: "/account/saved/sellers", label: "Saved Sellers" },
] as const;

/** The Saved tabs, with a purple underline on the one you are on (same look as the seller-profile tabs). */
export function SavedTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex border-b border-zinc-200 text-sm font-medium dark:border-zinc-800">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 px-4 py-2 text-center ${
              active ? "border-b-2 border-purple-700 text-purple-800 dark:text-purple-300" : "text-zinc-600 hover:text-purple-800 dark:text-zinc-400 dark:hover:text-purple-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
