import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";

/**
 * Buyer-site shell — header + footer on the homepage, Browse and listing pages
 * (docs/buyer-funnel-search.md §6). No auth guard here (buy/favourite/message
 * are gated in their own actions).
 */
export default function ShopLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
