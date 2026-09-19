import { describe, it, expect } from "vitest";
import { formatDay, formatMonthYear } from "./format-date";

describe("formatDay: the seller's last-active date", () => {
  it("shows day, short month and year", () => {
    expect(formatDay(new Date("2026-09-10T08:00:00Z"))).toBe("10 Sep 2026");
    expect(formatDay(new Date("2026-01-03T00:00:00Z"))).toBe("3 Jan 2026");
  });

  it("uses the UTC date, so it does not shift with the server's time zone", () => {
    expect(formatDay(new Date("2026-12-31T23:30:00Z"))).toBe("31 Dec 2026");
  });

  it("is a dash when there is no date", () => {
    expect(formatDay(null)).toBe("—");
  });
});

describe("formatMonthYear: 'on IVO since'", () => {
  it("shows the full month name and year", () => {
    expect(formatMonthYear(new Date("2026-09-10T08:00:00Z"))).toBe("September 2026");
    expect(formatMonthYear(new Date("2027-01-31T23:59:00Z"))).toBe("January 2027");
  });
});
