/**
 * @jest-environment node
 */
import {
  adminListLimit,
  adminListHeaders,
  ADMIN_LIST_MAX,
} from "@/lib/admin-list";

describe("adminListLimit", () => {
  it.each([
    ["null", null],
    ["empty", ""],
    ["not a number", "abc"],
    ["zero", "0"],
    ["negative", "-5"],
  ])("falls back to the maximum for %s", (_label, raw) => {
    expect(adminListLimit(raw)).toBe(ADMIN_LIST_MAX);
  });

  it("honours a smaller caller-supplied limit", () => {
    expect(adminListLimit("25")).toBe(25);
  });

  it("clamps a larger one to the maximum", () => {
    expect(adminListLimit("100000")).toBe(ADMIN_LIST_MAX);
  });
});

describe("adminListHeaders", () => {
  it("reports the true total and flags a truncated page", () => {
    // The cap must not be silent: the response is a bare array, so these
    // headers are the only way a caller can tell rows were left behind.
    expect(adminListHeaders(1200, 500)).toEqual({
      "X-Total-Count": "1200",
      "X-Result-Truncated": "true",
    });
  });

  it("does not flag a complete page", () => {
    expect(adminListHeaders(12, 12)).toEqual({
      "X-Total-Count": "12",
      "X-Result-Truncated": "false",
    });
  });
});
