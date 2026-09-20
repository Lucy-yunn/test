import { describe, it, expect } from "vitest";
import {
  CONDITION_AND_RETURNS,
  DEMO_DISCLAIMER,
  HOW_MATCHING_WORKS,
  LEGAL_PLACEHOLDER_NOTE,
  OPERATOR_LINE,
  PAYMENT_METHODS_LINE,
} from "./policy-copy";
import { FOOTER_COLUMNS, INFO_PAGES } from "./info-pages";

const all = (paragraphs: readonly string[]) => paragraphs.join(" ");

describe("the policy copy says what docs/buyer-funnel-search.md section 6 requires", () => {
  it("How matching works: parts are listed by the car they came from, fit is not verified, the seller is the party to the sale", () => {
    const text = all(HOW_MATCHING_WORKS);
    expect(text).toMatch(/removed from/i);
    expect(text).toMatch(/does not verify/i);
    expect(text).toMatch(/not guaranteed/i);
    expect(text).toMatch(/part number/i);
    expect(text).toMatch(/engine/i);
    expect(text).toMatch(/gearbox/i);
    expect(text).toMatch(/marketplace/i);
    expect(text).toMatch(/seller is the contracting party/i);
  });

  it("Condition and returns: pay the seller in cash after inspecting, decline at the courier, cancel before handover, no returns process, EU rights unaffected", () => {
    const text = all(CONDITION_AND_RETURNS);
    expect(text).toMatch(/as described/i);
    expect(text).toMatch(/photos/i);
    expect(text).toMatch(/defect/i);
    expect(text).toMatch(/pay the seller in cash/i);
    expect(text).toMatch(/inspect/i);
    expect(text).toMatch(/courier/i);
    expect(text).toMatch(/decline/i);
    expect(text).toMatch(/before handover/i);
    expect(text).toMatch(/no returns/i);
    expect(text).toMatch(/EU statutory consumer rights/i);
  });

  it("the payment line says cash on delivery, and no policy text mentions the old payment or shipping model", () => {
    expect(PAYMENT_METHODS_LINE).toMatch(/cash on delivery/i);
    const everything = all([PAYMENT_METHODS_LINE, OPERATOR_LINE, ...HOW_MATCHING_WORKS, ...CONDITION_AND_RETURNS, DEMO_DISCLAIMER]);
    expect(everything).not.toMatch(/bank transfer|\bcard\b|shipping|shipped|tracking/i);
  });

  it("the demo disclaimer and the legal placeholder warning are present", () => {
    expect(DEMO_DISCLAIMER).toMatch(/no real orders, payments, or personal data/i);
    expect(LEGAL_PLACEHOLDER_NOTE).toMatch(/placeholder/i);
    expect(LEGAL_PLACEHOLDER_NOTE).toMatch(/before launch/i);
  });
});

describe("the footer and the policy pages", () => {
  it("has a Buying, Help and Legal column", () => {
    expect(FOOTER_COLUMNS.map((c) => c.title)).toEqual(["Buying", "Help", "Legal"]);
  });

  it("every info link in the footer has a page, so none leads to a 404", () => {
    const slugs = FOOTER_COLUMNS.flatMap((c) => c.links).map(([href]) => href).filter((h) => h.startsWith("/info/")).map((h) => h.slice("/info/".length));
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(INFO_PAGES[slug], `no page for /info/${slug}`).toBeDefined();
  });

  it("the two policy pages carry the real policy text, the rest are marked as placeholders", () => {
    expect(INFO_PAGES["how-matching-works"].paragraphs).toEqual(HOW_MATCHING_WORKS);
    expect(INFO_PAGES["returns"].paragraphs).toEqual(CONDITION_AND_RETURNS);
    for (const slug of ["contacts", "help", "sell", "terms", "privacy"]) {
      expect(INFO_PAGES[slug].placeholder, slug).toBe(true);
    }
  });
});
