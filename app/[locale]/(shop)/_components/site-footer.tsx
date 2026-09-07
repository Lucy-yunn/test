import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-4">
        <div>
          <p className="text-lg font-bold">IVO</p>
          <p className="mt-1 text-zinc-500">{t("tagline")}</p>
        </div>
        <FooterCol title="Buying" links={[["/browse", "Browse parts"], ["/info/how-matching-works", "How matching works"], ["/info/returns", "Condition & returns"]]} />
        <FooterCol title="Help" links={[["/info/contacts", "Contact us"], ["/info/help", "Help centre"], ["/info/sell", "Sell with us"]]} />
        <FooterCol title="Legal" links={[["/info/terms", "Terms"], ["/info/privacy", "Privacy"], ["/info/returns", "Cancellations & returns"]]} />
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-zinc-500">
          <p>IVO — operated by the founders. VAT number: placeholder.</p>
          <p>Payment methods: bank transfer · card (not enabled in the demo).</p>
          <p>
            <strong>How matching works.</strong> Results show parts by the vehicle
            they were <em>removed from</em>. IVO does not verify that a part fits
            any other vehicle — a part from the same generation is not guaranteed to
            fit yours. Always check the part number and the listed engine / gearbox
            details against your own car before buying. IVO is a marketplace; the
            seller is the contracting party for each order.
          </p>
          <p>
            <strong>Condition &amp; returns.</strong> Parts are sold as described,
            with photos and a defect list. You can cancel any time before dispatch;
            once shipped there is no cancellation and no returns/refunds process in
            v1. Your EU statutory consumer rights are unaffected.
          </p>
          <p className="text-amber-700 dark:text-amber-500">{t("legalNote")}</p>
          <p>Demo build — no real orders, payments, or personal data.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-zinc-500">
        {links.map(([href, label]) => (
          <li key={href + label}>
            <Link href={href} className="hover:underline">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
