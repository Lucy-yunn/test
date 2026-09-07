import { defineRouting } from "next-intl/routing";

/**
 * v1 ships English content only. `bg` (and later nl/de/fr/ro) are scaffolded:
 * adding a locale later is one messages file + one array entry (ADR-0001 §i18n).
 * Selecting a not-yet-translated locale shows a notice and reverts — handled in the UI.
 */
export const routing = defineRouting({
  locales: ["en", "bg"],
  defaultLocale: "en",
  // Only the fully-translated locales; drives the "not translated yet" notice.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/** Locales with complete message catalogs. `bg` is intentionally excluded in v1. */
export const completeLocales: readonly Locale[] = ["en"];
