import { CONDITION_AND_RETURNS, HOW_MATCHING_WORKS } from "./policy-copy";

/**
 * The policy and help pages under /info and the links to them in the footer. Node-safe.
 * Only the two buyer policies carry real text (from `policy-copy`); the rest are placeholders
 * that need a real pass before launch.
 */
export interface InfoPage {
  title: string;
  paragraphs: readonly string[];
  /** True when the page has no real copy yet. */
  placeholder: boolean;
}

const PLACEHOLDER: readonly string[] = ["Placeholder content. The real copy for this page needs a proper pass before launch."];

export const INFO_PAGES: Record<string, InfoPage> = {
  contacts: { title: "Contact us", paragraphs: PLACEHOLDER, placeholder: true },
  help: { title: "Help centre", paragraphs: PLACEHOLDER, placeholder: true },
  sell: { title: "Sell with IVO", paragraphs: PLACEHOLDER, placeholder: true },
  terms: { title: "Terms of use", paragraphs: PLACEHOLDER, placeholder: true },
  privacy: { title: "Privacy policy", paragraphs: PLACEHOLDER, placeholder: true },
  returns: { title: "Condition, cancellations & returns", paragraphs: CONDITION_AND_RETURNS, placeholder: false },
  "how-matching-works": { title: "How matching works", paragraphs: HOW_MATCHING_WORKS, placeholder: false },
};

export const FOOTER_COLUMNS: { title: string; links: [href: string, label: string][] }[] = [
  {
    title: "Buying",
    links: [
      ["/browse", "Browse parts"],
      ["/info/how-matching-works", "How matching works"],
      ["/info/returns", "Condition & returns"],
    ],
  },
  {
    title: "Help",
    links: [
      ["/info/contacts", "Contact us"],
      ["/info/help", "Help centre"],
      ["/info/sell", "Sell with us"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/info/terms", "Terms"],
      ["/info/privacy", "Privacy"],
      ["/info/returns", "Cancellations & returns"],
    ],
  },
];
