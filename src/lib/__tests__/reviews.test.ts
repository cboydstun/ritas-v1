/**
 * @jest-environment node
 */
import { getReviewSummary, summarise, type Review } from "@/lib/reviews";

const review = (overrides: Partial<Review> = {}): Review => ({
  _id: "r1",
  authorName: "Sam Rivera",
  rating: 5,
  text: "Great machine, easy delivery.",
  time: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

describe("summarise", () => {
  it("reports counts, mean and satisfaction rate", () => {
    const summary = summarise([
      review({ _id: "a", rating: 5 }),
      review({ _id: "b", rating: 5 }),
      review({ _id: "c", rating: 4 }),
      review({ _id: "d", rating: 2 }),
    ]);

    expect(summary.count).toBe(4);
    expect(summary.averageRating).toBe(4);
    expect(summary.fiveStarCount).toBe(2);
    expect(summary.satisfactionRate).toBe(75);
  });

  // A rating of 0 out of 0 is worse than no rating at all — the homepage
  // omits the aggregateRating node entirely when this is null.
  it("returns a null average rather than zero when there are no reviews", () => {
    const summary = summarise([]);

    expect(summary.averageRating).toBeNull();
    expect(summary.count).toBe(0);
    expect(summary.satisfactionRate).toBe(0);
  });
});

describe("getReviewSummary", () => {
  afterEach(() => jest.restoreAllMocks());

  it("accepts a bare array from the upstream", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [review()],
    })) as unknown as typeof fetch;

    await expect(getReviewSummary()).resolves.toMatchObject({ count: 1 });
  });

  it("accepts a { reviews: [...] } envelope from the upstream", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ reviews: [review(), review({ _id: "r2" })] }),
    })) as unknown as typeof fetch;

    await expect(getReviewSummary()).resolves.toMatchObject({ count: 2 });
  });

  it("drops entries that are not shaped like a review", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [review(), { nope: true }, null],
    })) as unknown as typeof fetch;

    await expect(getReviewSummary()).resolves.toMatchObject({ count: 1 });
  });

  // A review-feed outage must not take the homepage down with it.
  it.each([
    ["a non-ok response", async () => ({ ok: false, status: 503 })],
    [
      "a network failure",
      async () => {
        throw new Error("ECONNREFUSED");
      },
    ],
  ])("returns an empty summary on %s", async (_label, impl) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn(impl) as unknown as typeof fetch;

    await expect(getReviewSummary()).resolves.toMatchObject({
      count: 0,
      averageRating: null,
    });
  });
});
