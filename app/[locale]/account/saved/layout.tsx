import { SavedTabs } from "./saved-tabs";

/**
 * Saved area shell (docs/seller-profile.md section 8): Saved Parts and Saved Sellers, styled
 * like the seller-profile tabs. No auth guard here, each page calls requireBuyer().
 */
export default function SavedLayout({ children }: LayoutProps<"/[locale]/account/saved">) {
  return (
    <div className="flex flex-col gap-4">
      <SavedTabs />
      {children}
    </div>
  );
}
