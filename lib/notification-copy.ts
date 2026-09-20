import type { NotificationType } from "@prisma/client";

/**
 * The line and the link for each notification (docs/notifications.md sections 3 and 5). Node-safe.
 * The feed adds an icon and the time. `orderCode` and `sellerId` come from what the notification
 * is about; when that no longer exists the link falls back to the feed.
 */
export interface NotificationContext {
  orderCode?: string | null;
  sellerId?: string | null;
}

const BUYER_FEED = "/account/notifications";
const SELLER_FEED = "/seller/notifications";

export function describeNotification(type: NotificationType, ctx: NotificationContext): { text: string; href: string } {
  const buyerOrder = ctx.orderCode ? `/account/orders/${ctx.orderCode}` : BUYER_FEED;
  const sellerOrder = ctx.orderCode ? `/seller/orders/${ctx.orderCode}` : SELLER_FEED;

  switch (type) {
    // Buyer
    case "order_confirmed":
      return { text: "The seller confirmed your order", href: buyerOrder };
    case "order_completed":
      return { text: "Order completed. Leave a review?", href: buyerOrder };
    case "order_refused":
      return { text: "The seller marked your order as refused", href: buyerOrder };
    case "cancellation_approved":
      return { text: "Cancellation approved. The item is available again", href: buyerOrder };
    case "review_replied":
      return { text: "The seller replied to your review", href: ctx.sellerId ? `/sellers/${ctx.sellerId}?tab=reviews` : BUYER_FEED };
    // Seller
    case "order_placed":
      return { text: "You have a new order", href: sellerOrder };
    case "cancellation_requested":
      return { text: "Cancellation requested. Approve or wait 7 days", href: sellerOrder };
    case "order_cancelled":
      return { text: "A buyer cancelled an order", href: sellerOrder };
    case "review_received":
      return { text: "You have a new review", href: "/seller/reviews" };
    case "credits_low":
      return { text: "5 or fewer credits left", href: "/seller/credits" };
    case "credits_empty":
      return { text: "You are out of credits", href: "/seller/credits" };
  }
}
