import { describe, it, expect } from "vitest";
import { threadListingBadge } from "./thread-badge";

describe("threadListingBadge: what the pinned listing header says (docs/messaging-model.md section 3.3)", () => {
  it("says nothing while the listing is on sale", () => {
    expect(threadListingBadge("published", "none")).toBeNull();
  });

  it("tells the buyer who reserved it", () => {
    expect(threadListingBadge("reserved", "viewer")).toBe("You've reserved this item");
    expect(threadListingBadge("reserved", "someone_else")).toBe("Reserved by another buyer");
  });

  it("says just Reserved to the seller, who has no 'by whom' to compare with", () => {
    expect(threadListingBadge("reserved", "none")).toBe("Reserved");
  });

  it("says Sold once it is sold", () => {
    expect(threadListingBadge("sold", "none")).toBe("Sold");
  });

  it("says No longer listed for cancelled, archived and draft", () => {
    for (const status of ["cancelled", "archived", "draft"] as const) {
      expect(threadListingBadge(status, "none")).toBe("No longer listed");
    }
  });
});
