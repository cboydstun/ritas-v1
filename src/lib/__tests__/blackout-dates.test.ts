/**
 * Covers the date helpers that moved out of `src/models/blackout-date.ts`
 * during the Next 16 upgrade — importing them from the model dragged mongoose
 * into the browser bundle. They decide which days `isMachineAvailable` refuses
 * and what the admin table prints, and nothing tested them before the move.
 */
import {
  createCentralTimeDate,
  createLocalDate,
  formatDateForCentralTime,
  isDateBlackedOut,
} from "@/lib/blackout-dates";

const day = (iso: string) => new Date(`${iso}T00:00:00`);

describe("isDateBlackedOut", () => {
  const singleDay = [{ startDate: "2026-07-04" }];
  const range = [{ startDate: "2026-07-01", endDate: "2026-07-05" }];

  it("blocks the day a single-day blackout names", () => {
    expect(isDateBlackedOut(day("2026-07-04"), singleDay)).toBe(true);
  });

  it("leaves other days alone", () => {
    expect(isDateBlackedOut(day("2026-07-03"), singleDay)).toBe(false);
    expect(isDateBlackedOut(day("2026-07-05"), singleDay)).toBe(false);
  });

  // Both ends are inclusive — a range that stopped a day short would put a
  // blacked-out day back on sale.
  it.each(["2026-07-01", "2026-07-03", "2026-07-05"])(
    "blocks %s inside an inclusive range",
    (iso) => {
      expect(isDateBlackedOut(day(iso), range)).toBe(true);
    },
  );

  it.each(["2026-06-30", "2026-07-06"])(
    "leaves %s outside the range alone",
    (iso) => {
      expect(isDateBlackedOut(day(iso), range)).toBe(false);
    },
  );

  it("ignores the time of day on the date being checked", () => {
    expect(isDateBlackedOut(new Date("2026-07-04T23:30:00"), singleDay)).toBe(
      true,
    );
  });

  it("reports false with no blackouts configured", () => {
    expect(isDateBlackedOut(day("2026-07-04"), [])).toBe(false);
  });

  it("matches against any blackout in the list", () => {
    expect(
      isDateBlackedOut(day("2026-12-25"), [
        { startDate: "2026-07-04" },
        { startDate: "2026-12-25" },
      ]),
    ).toBe(true);
  });
});

describe("createLocalDate", () => {
  // Parsing "2026-07-04" with `new Date()` yields UTC midnight, which is the
  // 3rd in Central time — the shift this helper exists to avoid.
  it("parses YYYY-MM-DD as local midnight", () => {
    const d = createLocalDate("2026-07-04");

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(4);
    expect(d.getHours()).toBe(0);
  });

  it("parses MM/DD/YYYY as local midnight", () => {
    const d = createLocalDate("07/04/2026");

    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(4);
  });

  it("passes a full ISO timestamp straight through", () => {
    expect(createLocalDate("2026-07-04T18:30:00.000Z").toISOString()).toBe(
      "2026-07-04T18:30:00.000Z",
    );
  });

  // Callers pass request-body values in. A non-string used to throw a
  // TypeError on `.includes`, surfacing as a 500 rather than a 400.
  it.each([42, null, undefined, {}])(
    "returns an invalid date for %p rather than throwing",
    (value) => {
      expect(
        Number.isNaN(createLocalDate(value as unknown as string).getTime()),
      ).toBe(true);
    },
  );

  it("still answers for a string it cannot structure", () => {
    expect(Number.isNaN(createLocalDate("not a date").getTime())).toBe(true);
  });

  it("createCentralTimeDate is the deprecated alias", () => {
    expect(createCentralTimeDate("2026-07-04").getTime()).toBe(
      createLocalDate("2026-07-04").getTime(),
    );
  });
});

describe("formatDateForCentralTime", () => {
  it("formats a YYYY-MM-DD string as MM/DD/YYYY", () => {
    expect(formatDateForCentralTime("2026-07-04")).toBe("07/04/2026");
  });

  it("formats an MM/DD/YYYY string unchanged", () => {
    expect(formatDateForCentralTime("07/04/2026")).toBe("07/04/2026");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatDateForCentralTime("2026-01-05")).toBe("01/05/2026");
  });

  // Mongo stores these as UTC midnight; reading them with local getters would
  // print the previous day everywhere west of Greenwich.
  it("reads a UTC-midnight date from the database as that calendar day", () => {
    expect(formatDateForCentralTime(new Date("2026-07-04T00:00:00.000Z"))).toBe(
      "07/04/2026",
    );
  });

  it("formats a local Date using its local components", () => {
    expect(formatDateForCentralTime(new Date(2026, 6, 4, 13, 30))).toBe(
      "07/04/2026",
    );
  });

  it.each(["", "not a date"])("reports %p as Invalid Date", (value) => {
    expect(formatDateForCentralTime(value)).toBe("Invalid Date");
  });
});
