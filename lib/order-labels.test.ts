import { describe, it, expect } from "vitest";
import { CancellationReason, ListingStatus, OrderStatus } from "@prisma/client";
import { CANCELLATION_REASON_LABEL, LISTING_STATUS_LABEL, ORDER_STATUS_LABEL, orderTracker } from "./order-labels";

describe("labels cover every value, so a new enum value cannot slip through unlabelled", () => {
  it("has a label for each order status", () => {
    expect(Object.keys(ORDER_STATUS_LABEL).sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it("has a label for each listing status", () => {
    expect(Object.keys(LISTING_STATUS_LABEL).sort()).toEqual(Object.values(ListingStatus).sort());
  });

  it("has a label for each cancellation reason", () => {
    expect(Object.keys(CANCELLATION_REASON_LABEL).sort()).toEqual(Object.values(CancellationReason).sort());
  });
});

describe("orderTracker: how far the pipeline placed, confirmed, completed has come", () => {
  const states = (t: ReturnType<typeof orderTracker>) => t.steps.map((s) => `${s.key}:${s.state}`);

  it("an order that was just placed is at its first step", () => {
    const t = orderTracker("placed", null);
    expect(states(t)).toEqual(["placed:current", "confirmed:todo", "completed:todo"]);
    expect(t.end).toBeNull();
  });

  it("a confirmed order has placed done and is at confirmed", () => {
    expect(states(orderTracker("confirmed", null))).toEqual(["placed:done", "confirmed:current", "completed:todo"]);
  });

  it("a completed order has every step done", () => {
    const t = orderTracker("completed", null);
    expect(states(t)).toEqual(["placed:done", "confirmed:done", "completed:done"]);
    expect(t.end).toBeNull();
  });

  it("a refused order is done up to confirmed and ends with a Refused marker", () => {
    const t = orderTracker("refused", null);
    expect(states(t)).toEqual(["placed:done", "confirmed:done", "completed:todo"]);
    expect(t.end).toBe("refused");
  });

  it("a cancelled order is done up to the step it had reached, then a Cancelled marker", () => {
    const early = orderTracker("cancelled", "placed");
    expect(states(early)).toEqual(["placed:done", "confirmed:todo", "completed:todo"]);
    expect(early.end).toBe("cancelled");

    const late = orderTracker("cancelled", "confirmed");
    expect(states(late)).toEqual(["placed:done", "confirmed:done", "completed:todo"]);
    expect(late.end).toBe("cancelled");
  });
});
