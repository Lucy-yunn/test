import { describe, it, expect } from "vitest";
import { NotificationType } from "@prisma/client";
import { describeNotification } from "./notification-copy";

describe("describeNotification: the line and the link for each event (docs/notifications.md section 3)", () => {
  const ctx = { orderCode: "ORD-000007", sellerId: "sel_1" };

  it("has copy for every notification type, so a new event cannot appear without wording", () => {
    for (const type of Object.values(NotificationType)) {
      const d = describeNotification(type, ctx);
      expect(d.text.length).toBeGreaterThan(0);
      expect(d.href.startsWith("/")).toBe(true);
    }
  });

  it("tells a buyer what the seller did, and links to the order", () => {
    expect(describeNotification("order_confirmed", ctx)).toEqual({ text: "The seller confirmed your order", href: "/account/orders/ORD-000007" });
    expect(describeNotification("order_completed", ctx)).toEqual({ text: "Order completed. Leave a review?", href: "/account/orders/ORD-000007" });
    expect(describeNotification("order_refused", ctx)).toEqual({ text: "The seller marked your order as refused", href: "/account/orders/ORD-000007" });
    expect(describeNotification("cancellation_approved", ctx)).toEqual({
      text: "Cancellation approved. The item is available again",
      href: "/account/orders/ORD-000007",
    });
  });

  it("sends a buyer whose review got a reply to that seller's Reviews tab", () => {
    expect(describeNotification("review_replied", ctx)).toEqual({ text: "The seller replied to your review", href: "/sellers/sel_1?tab=reviews" });
  });

  it("tells a seller about orders and links to the order in the seller center", () => {
    expect(describeNotification("order_placed", ctx)).toEqual({ text: "You have a new order", href: "/seller/orders/ORD-000007" });
    expect(describeNotification("cancellation_requested", ctx)).toEqual({
      text: "Cancellation requested. Approve or wait 7 days",
      href: "/seller/orders/ORD-000007",
    });
    expect(describeNotification("order_cancelled", ctx)).toEqual({ text: "A buyer cancelled an order", href: "/seller/orders/ORD-000007" });
  });

  it("tells a seller about reviews and credits", () => {
    expect(describeNotification("review_received", ctx)).toEqual({ text: "You have a new review", href: "/seller/reviews" });
    expect(describeNotification("credits_low", ctx)).toEqual({ text: "5 or fewer credits left", href: "/seller/credits" });
    expect(describeNotification("credits_empty", ctx)).toEqual({ text: "You are out of credits", href: "/seller/credits" });
  });

  it("falls back to the feed when what it was about no longer exists", () => {
    expect(describeNotification("order_confirmed", {}).href).toBe("/account/notifications");
    expect(describeNotification("order_placed", {}).href).toBe("/seller/notifications");
    expect(describeNotification("review_replied", {}).href).toBe("/account/notifications");
  });
});
