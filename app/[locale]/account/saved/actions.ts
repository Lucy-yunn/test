"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBuyer } from "@/lib/dal/session";
import { NotFoundError } from "@/lib/dal";
import { saveListing, unsaveListing } from "@/lib/services/favourites";

/**
 * Save / unsave one Listing for the signed-in buyer. Re-checks the role inside
 * the action (docs/auth-and-permissions.md §10). The rules live in
 * lib/services/favourites.ts; this is only the Next glue.
 */
export async function setSavedAction(code: string, save: boolean): Promise<void> {
  const actor = await requireBuyer();
  try {
    if (save) await saveListing(db, actor, code);
    else await unsaveListing(db, actor, code);
  } catch (err) {
    // The listing stopped being buyer-visible between render and click; the
    // refresh below shows the truth.
    if (!(err instanceof NotFoundError)) throw err;
  }
  revalidatePath("/[locale]/listing/[code]", "page");
  revalidatePath("/[locale]/account/saved/parts", "page");
}
