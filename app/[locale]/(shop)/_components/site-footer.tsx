import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FOOTER_COLUMNS } from "@/lib/info-pages";
import {
  CONDITION_AND_RETURNS,
  DEMO_DISCLAIMER,
  HOW_MATCHING_WORKS,
  OPERATOR_LINE,
  PAYMENT_METHODS_LINE,
} from "@/lib/policy-copy";

/**
 * The commerce footer (docs/buyer-funnel-search.md section 6): Buying, Help and Legal columns, the
 * operator and VAT line, the payment method, and the policy block. The wording comes from
 * `lib/policy-copy`, the same source as the policy pages.
 */
export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
        <div>
          <p className="text-lg font-bold">IVO</p>
          <p className="mt-1 text-zinc-500">{t("tagline")}</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <FooterCol key={col.title} title={col.title} links={col.links} />
        ))}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-zinc-500">
          <p>{OPERATOR_LINE}</p>
          <p>{PAYMENT_METHODS_LINE}</p>
          <p>
            <strong>How matching works.</strong> {HOW_MATCHING_WORKS.join(" ")}
          </p>
          <p>
            <strong>Condition &amp; returns.</strong> {CONDITION_AND_RETURNS.join(" ")}
          </p>
          <p className="text-amber-700 dark:text-amber-500">{t("legalNote")}</p>
          <p>{DEMO_DISCLAIMER}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-zinc-500">
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
