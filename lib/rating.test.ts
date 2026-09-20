import { describe, it, expect } from "vitest";
import { MIN_REVIEWS_FOR_RATING, formatRating, summariseRatings } from "./rating";

const many = (fives: number, fours: number) => [...Array(fives).fill(5), ...Array(fours).fill(4)] as number[];

describe("summariseRatings: the average and count over the reviews that are shown (docs/reviews.md section 4)", () => {
  it("has no average for no reviews", () => {
    expect(summariseRatings([])).toEqual({ count: 0, average: null, isNew: true });
  });

  it("averages every rating and rounds to one decimal", () => {
    expect(summariseRatings([5, 5, 4])).toMatchObject({ count: 3, average: 4.7 }); // 14 / 3 = 4.67
    expect(summariseRatings(many(8, 2))).toMatchObject({ count: 10, average: 4.8 }); // 48 / 10
    expect(summariseRatings([1, 2, 3])).toMatchObject({ average: 2 });
  });

  it("rounds a half up", () => {
    expect(summariseRatings(many(17, 3)).average).toBe(4.9); // 97 / 20 = 4.85
    expect(summariseRatings([5, 4]).average).toBe(4.5);
  });

  it("is new below the minimum number of reviews, and not from it", () => {
    expect(MIN_REVIEWS_FOR_RATING).toBe(3);
    expect(summariseRatings([5, 5]).isNew).toBe(true);
    expect(summariseRatings([5, 5, 5]).isNew).toBe(false);
  });
});

describe("formatRating: how a seller's rating reads", () => {
  it("says New seller below 3 reviews, whatever the ratings are", () => {
    expect(formatRating({ count: 0, average: null, isNew: true })).toBe("New seller");
    expect(formatRating({ count: 2, average: 5, isNew: true })).toBe("New seller");
  });

  it("reads 4.8/5 (10) from 3 reviews, with one decimal even for a whole number", () => {
    expect(formatRating({ count: 10, average: 4.8, isNew: false })).toBe("4.8/5 (10)");
    expect(formatRating({ count: 3, average: 5, isNew: false })).toBe("5.0/5 (3)");
  });
});
