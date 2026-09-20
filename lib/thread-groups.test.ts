import { describe, it, expect } from "vitest";
import { groupThreads, inFolder, parseFolder, type GroupableThread } from "./thread-groups";

const at = (n: number) => new Date(2026, 8, n);
const t = (id: string, party: string, listing: string | null, day: number, unread = 0): GroupableThread => ({
  id,
  otherPartyId: party,
  otherPartyName: `Name ${party}`,
  listing: listing ? { code: listing, title: `Title ${listing}` } : null,
  lastMessageAt: at(day),
  unread,
});

describe("grouping conversations", () => {
  const items = [t("1", "anna", "L1", 5), t("2", "boris", "L1", 4, 2), t("3", "anna", "L2", 3, 1), t("4", "anna", null, 1)];

  it("by person: one group per buyer (or seller), newest activity first, with the unread total", () => {
    const groups = groupThreads(items, "person");
    expect(groups.map((g) => [g.key, g.title, g.threads.map((x) => x.id), g.unread])).toEqual([
      ["anna", "Name anna", ["1", "3", "4"], 1],
      ["boris", "Name boris", ["2"], 2],
    ]);
  });

  it("by listing: one group per listing, with direct conversations together in their own group at the end", () => {
    const groups = groupThreads(items, "listing");
    expect(groups.map((g) => [g.key, g.title, g.threads.map((x) => x.id)])).toEqual([
      ["L1", "Title L1", ["1", "2"]],
      ["L2", "Title L2", ["3"]],
      ["direct", "Direct conversations", ["4"]],
    ]);
  });

  it("orders groups by their most recent conversation, whatever the order it was given", () => {
    const groups = groupThreads([t("a", "x", "L9", 1), t("b", "y", "L8", 9), t("c", "z", "L7", 5)], "listing");
    expect(groups.map((g) => g.key)).toEqual(["L8", "L7", "L9"]);
  });

  it("gives no groups for no conversations", () => {
    expect(groupThreads([], "person")).toEqual([]);
  });
});

describe("which folder a conversation is in", () => {
  const base = { trashed: false, needsReply: false };

  it("the seller's unanswered folder holds what the buyer wrote last, and answered holds the rest", () => {
    expect(inFolder({ ...base, needsReply: true }, "unanswered")).toBe(true);
    expect(inFolder({ ...base, needsReply: true }, "answered")).toBe(false);
    expect(inFolder(base, "answered")).toBe(true);
    expect(inFolder(base, "unanswered")).toBe(false);
  });

  it("the trash holds only what was trashed, and nothing trashed shows anywhere else", () => {
    const trashed = { trashed: true, needsReply: true };
    expect(inFolder(trashed, "trash")).toBe(true);
    for (const f of ["unanswered", "answered", "inbox"] as const) expect(inFolder(trashed, f)).toBe(false);
    expect(inFolder(base, "trash")).toBe(false);
  });

  it("the buyer's inbox is everything that is not in the trash", () => {
    expect(inFolder(base, "inbox")).toBe(true);
    expect(inFolder({ ...base, needsReply: true }, "inbox")).toBe(true);
  });

  it("reads a folder from the address, falling back to the first for anything else", () => {
    expect(parseFolder("trash", ["unanswered", "answered", "trash"])).toBe("trash");
    expect(parseFolder("nonsense", ["unanswered", "answered", "trash"])).toBe("unanswered");
    expect(parseFolder(undefined, ["inbox", "trash"])).toBe("inbox");
  });
});
