import { notFound } from "next/navigation";

/**
 * Catches every address that no other page matches, so it shows the site's own Page not found
 * (app/[locale]/(shop)/not-found.tsx), inside the header and footer, instead of Next's plain default.
 */
export default function CatchAll() {
  notFound();
}
