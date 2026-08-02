/**
 * @jest-environment node
 */
import { isMachineAvailable, STALE_HOLD_MINUTES } from "../inventory";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { BlackoutDate } from "@/models/blackout-date";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/settings", () => ({
  Settings: { findOne: jest.fn() },
}));

jest.mock("@/models/blackout-date", () => {
  const actual = jest.requireActual("@/models/blackout-date");
  return {
    ...actual,
    BlackoutDate: { find: jest.fn() },
  };
});

jest.mock("@/models/rental", () => ({
  Rental: { find: jest.fn() },
}));

function mockSettingsInventory(
  inventory: { single?: number; double?: number; triple?: number } | null,
) {
  (Settings.findOne as jest.Mock).mockReturnValue({
    lean: jest.fn().mockResolvedValue(
      inventory === null
        ? null
        : {
            machines: {
              single:
                inventory.single !== undefined
                  ? { inventory: inventory.single }
                  : {},
              double:
                inventory.double !== undefined
                  ? { inventory: inventory.double }
                  : {},
              triple:
                inventory.triple !== undefined
                  ? { inventory: inventory.triple }
                  : {},
            },
          },
    ),
  });
}

function mockOverlappingRentals(
  rentals: Array<{ rentalDate: string; returnDate: string }>,
) {
  (Rental.find as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(rentals),
    }),
  });
}

function mockBlackouts(blackouts: Array<{ startDate: Date; endDate?: Date }>) {
  (BlackoutDate.find as jest.Mock).mockResolvedValue(blackouts);
}

describe("isMachineAvailable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBlackouts([]);
  });

  describe("inventory enforcement", () => {
    it("returns available when no overlapping rentals exist", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(true);
    });

    it("returns available when bookings are below the cap", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(true);
    });

    it("returns unavailable when bookings reach the cap", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/booked/i);
    });

    it("counts pending_payment rentals against the cap", async () => {
      mockSettingsInventory({ double: 3 });
      mockOverlappingRentals([
        { rentalDate: "2026-05-23", returnDate: "2026-05-23" },
        { rentalDate: "2026-05-23", returnDate: "2026-05-23" },
        { rentalDate: "2026-05-23", returnDate: "2026-05-23" },
      ]);

      const result = await isMachineAvailable(
        "double",
        30,
        "2026-05-23",
        "2026-05-23",
      );

      expect(result.available).toBe(false);
      // Unpaid holds live in the $or branch that also carries the age cutoff.
      const statuses = (Rental.find as jest.Mock).mock.calls[0][0].$or.flatMap(
        (clause: { status: { $in: string[] } }) => clause.status.$in,
      );
      expect(statuses).toEqual(
        expect.arrayContaining([
          "pending",
          "pending_payment",
          "confirmed",
          "in-progress",
        ]),
      );
    });

    it("returns unavailable when inventory is 0", async () => {
      mockSettingsInventory({ triple: 0 });
      mockOverlappingRentals([]);

      const result = await isMachineAvailable(
        "triple",
        45,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(false);
    });
  });

  describe("multi-day range", () => {
    it("returns unavailable when a middle day in the range is at cap", async () => {
      mockSettingsInventory({ double: 2 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-16", returnDate: "2026-06-16" },
        { rentalDate: "2026-06-16", returnDate: "2026-06-16" },
      ]);

      const result = await isMachineAvailable(
        "double",
        30,
        "2026-06-15",
        "2026-06-17",
      );

      expect(result.available).toBe(false);
    });

    it("returns available when every day has spare capacity", async () => {
      mockSettingsInventory({ double: 2 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-17", returnDate: "2026-06-17" },
      ]);

      const result = await isMachineAvailable(
        "double",
        30,
        "2026-06-15",
        "2026-06-17",
      );

      expect(result.available).toBe(true);
    });

    it("treats omitted returnDate as a single-day range", async () => {
      mockSettingsInventory({ single: 1 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable("single", 15, "2026-06-15");

      expect(result.available).toBe(false);
    });

    it("counts a multi-day rental against every day it covers", async () => {
      mockSettingsInventory({ single: 1 });
      mockOverlappingRentals([
        { rentalDate: "2026-06-14", returnDate: "2026-06-20" },
      ]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-17",
      );

      expect(result.available).toBe(false);
    });
  });

  describe("inventory defaults", () => {
    // The fallbacks must match the Settings schema defaults (single 3,
    // double 3, triple 2), otherwise availability changes the moment an
    // admin first saves settings.
    it("falls back to 3 single units when the settings doc is missing", async () => {
      mockSettingsInventory(null);
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(true);
    });

    it("rejects once the fallback inventory is exhausted", async () => {
      mockSettingsInventory(null);
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(false);
    });

    it("falls back to 2 triple units when the inventory field is missing", async () => {
      mockSettingsInventory({});
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "triple",
        45,
        "2026-06-15",
        "2026-06-15",
      );

      expect(result.available).toBe(false);
    });
  });

  describe("blackout precedence", () => {
    it("returns unavailable when any day in range is blacked out", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([]);
      mockBlackouts([{ startDate: new Date("2026-06-16T00:00:00") }]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-17",
      );

      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/blackout/i);
    });

    it("allows the booking when blackout is outside the requested range", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([]);
      mockBlackouts([{ startDate: new Date("2026-06-20T00:00:00") }]);

      const result = await isMachineAvailable(
        "single",
        15,
        "2026-06-15",
        "2026-06-17",
      );

      expect(result.available).toBe(true);
    });
  });
  describe("stale hold expiry", () => {
    // Availability must not depend on the cleanup job having run: the Hobby
    // plan caps cron at once a day, so an abandoned hold could otherwise block
    // a unit for up to 24 hours. Expiry is enforced in the query instead.
    it("only counts unpaid holds newer than the cutoff", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([]);
      mockBlackouts([]);

      await isMachineAvailable("single", 15, "2026-06-15", "2026-06-15");

      const query = (Rental.find as jest.Mock).mock.calls[0][0];
      expect(query.$or).toHaveLength(2);

      const settled = query.$or.find((clause: { status: { $in: string[] } }) =>
        clause.status.$in.includes("confirmed"),
      );
      const holds = query.$or.find((clause: { status: { $in: string[] } }) =>
        clause.status.$in.includes("pending"),
      );

      // Paid/active bookings always count, with no age condition.
      expect(settled.createdAt).toBeUndefined();
      expect(settled.status.$in).toEqual(["confirmed", "in-progress"]);

      // Unpaid holds count only while recent.
      expect(holds.status.$in).toEqual(["pending", "pending_payment"]);
      expect(holds.createdAt.$gte).toBeInstanceOf(Date);

      const ageMinutes =
        (Date.now() - holds.createdAt.$gte.getTime()) / (1000 * 60);
      expect(ageMinutes).toBeCloseTo(STALE_HOLD_MINUTES, 0);
    });

    it("excludes a named rental so a booking cannot block itself", async () => {
      mockSettingsInventory({ single: 3 });
      mockOverlappingRentals([]);
      mockBlackouts([]);

      await isMachineAvailable("single", 15, "2026-06-15", "2026-06-15", {
        excludeRentalId: "507f1f77bcf86cd799439011",
      });

      const query = (Rental.find as jest.Mock).mock.calls[0][0];
      expect(query._id).toEqual({ $ne: "507f1f77bcf86cd799439011" });
    });
  });
});
