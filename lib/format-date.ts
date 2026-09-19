/**
 * Small date formatters for the public seller pages. English only for now (the UI is
 * English in v1). Uses the UTC date so the output never shifts with the server's zone,
 * and a fixed month table so it does not depend on the runtime's locale data.
 */

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "10 Sep 2026", or a dash when unknown. */
export function formatDay(date: Date | null): string {
  if (!date) return "—";
  return `${date.getUTCDate()} ${SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "September 2026". */
export function formatMonthYear(date: Date): string {
  return `${LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
