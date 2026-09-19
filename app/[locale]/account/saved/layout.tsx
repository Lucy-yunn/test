import { Link } from "@/i18n/navigation";

/**
 * Saved area shell (docs/seller-profile.md section 8): Saved Parts and Saved Sellers, styled
 * like the seller-profile tabs. No auth guard here, each page calls requireBuyer().
 */
export default function SavedLayout({ children }: LayoutProps<"/[locale]/account/saved">) {
  const tab = "flex-1 px-4 py-2 text-center hover:text-purple-800 dark:hover:text-purple-300";
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex border-b border-zinc-200 text-sm font-medium dark:border-zinc-800">
        <Link href="/account/saved/parts" className={tab}>
          Saved Parts
        </Link>
        <Link href="/account/saved/sellers" className={tab}>
          Saved Sellers
        </Link>
      </nav>
      {children}
    </div>
  );
}
