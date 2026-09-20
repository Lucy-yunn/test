import type { CancellationReason, OrderStatus } from "@prisma/client";

/** Wording for orders (docs/order-model.md sections 3, 6.1 and 7). Node-safe. */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  refused: "Refused",
};

export const CANCELLATION_REASON_LABEL: Record<CancellationReason, string> = {
  found_elsewhere: "Found the part cheaper / elsewhere",
  no_longer_needed: "No longer need the part",
  seller_too_slow: "Seller took too long to confirm",
  condition_or_fitment_concern: "Concerns about the part's condition or fitment",
  ordered_by_mistake: "Ordered by mistake",
  other: "Other",
};

/** The short line under the current step on the buyer's order page. */
export const ORDER_STEP_NOTE: Partial<Record<OrderStatus, string>> = {
  placed: "The seller will confirm shortly",
  confirmed: "The seller is arranging the courier. Pay on delivery, after inspecting the part.",
};

const PIPELINE = ["placed", "confirmed", "completed"] as const;
type Step = (typeof PIPELINE)[number];

export interface OrderTracker {
  steps: { key: Step; state: "done" | "current" | "todo" }[];
  /** A marker shown below the pipeline when the order ended some other way. */
  end: "cancelled" | "refused" | null;
}

/**
 * How far an order has come along placed, confirmed, completed. A cancelled order is done
 * up to the step it had reached (`lastReachedStatus`) and then shows a Cancelled marker; a
 * refused order is done up to confirmed and shows a Refused marker.
 */
export function orderTracker(status: OrderStatus, lastReachedStatus: OrderStatus | null): OrderTracker {
  const reached = (s: OrderStatus | null): number => PIPELINE.findIndex((p) => p === s);

  if (status === "completed") {
    return { steps: PIPELINE.map((key) => ({ key, state: "done" as const })), end: null };
  }
  const isEnded = status === "cancelled" || status === "refused";
  const doneUpTo = status === "refused" ? reached("confirmed") : status === "cancelled" ? reached(lastReachedStatus) : reached(status) - 1;
  const currentIndex = isEnded ? -1 : reached(status);

  return {
    steps: PIPELINE.map((key, i) => ({
      key,
      state: i === currentIndex ? "current" : i <= doneUpTo ? "done" : "todo",
    })),
    end: isEnded ? status : null,
  };
}
