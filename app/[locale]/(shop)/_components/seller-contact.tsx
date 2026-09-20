import { Link } from "@/i18n/navigation";
import { phoneHref, type SellerContact } from "@/lib/services/seller-contact";

/**
 * Shows the seller's contact exactly as the service allowed it (sellerContactFor): the
 * number and a tap-to-call link, a "no phone" note, or a sign-in button. It never decides
 * who may see the number, so it cannot disagree with the rule.
 *
 * The listing page and the seller header look slightly different, so the wording and
 * classes that differ are props and the default matches neither by accident.
 */
export function SellerContactView({
  contact,
  signInHref,
  signInClassName,
  phoneLabel,
  phoneClassName,
  emptyNote,
}: {
  contact: SellerContact;
  /** Where the sign-in button goes (it comes back to this page afterwards). */
  signInHref: string;
  signInClassName: string;
  /** Text before the number, for example "Phone:". */
  phoneLabel?: string;
  /** Classes for the line that holds the number. Without it the number is not wrapped. */
  phoneClassName?: string;
  /** Shown to a signed-in user when the seller has no phone. Without it nothing is shown. */
  emptyNote?: string;
}) {
  if (contact.kind === "sign_in") {
    return (
      <Link href={signInHref} className={signInClassName}>
        Sign in to get seller contact
      </Link>
    );
  }

  if (contact.kind === "none") {
    return emptyNote ? <span className="text-zinc-500">{emptyNote}</span> : null;
  }

  const number = (
    <a href={phoneHref(contact.phone)} className="text-purple-700 underline">
      {contact.phone}
    </a>
  );
  return phoneClassName ? (
    <p className={phoneClassName}>
      {phoneLabel ? <>{phoneLabel} </> : null}
      {number}
    </p>
  ) : (
    number
  );
}
