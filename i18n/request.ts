import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Fall back to the default locale's catalog for any locale that is only
    // scaffolded (e.g. `bg` in v1), so the app never renders raw message keys.
    messages: (
      await import(`../messages/${locale}.json`).catch(
        () => import(`../messages/${routing.defaultLocale}.json`),
      )
    ).default,
  };
});
