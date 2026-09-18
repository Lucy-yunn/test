import { Link } from "@/i18n/navigation";

/**
 * Saved area shell (docs/seller-profile.md §8). Two tabs eventually: Saved Parts
 * and Saved Sellers. Saved Sellers arrives with the seller profile (build step 8),
 * so only Saved Parts is shown for now. No auth guard here — each page calls
 * requireBuyer().
 */
export default function SavedLayout({ children }: LayoutProps<"/[locale]/account/saved">) {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-6 border-b border-zinc-200 text-sm dark:border-zinc-800">
        <Link href="/account/saved/parts" className="border-b-2 border-purple-700 pb-2 font-medium text-purple-800 dark:text-purple-300">
          Saved Parts
        </Link>
      </nav>
      {children}
    </div>
  );
}
