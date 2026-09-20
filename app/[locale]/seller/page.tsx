import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/dal/session";

/** A seller's landing page. Until the seller center (step 13), it is the Orders screen. */
export default async function SellerHome({ params }: PageProps<"/[locale]/seller">) {
  const { locale } = await params;
  await requireSeller();
  redirect({ href: "/seller/orders", locale });
}
