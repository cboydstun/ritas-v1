/**
 * @jest-environment node
 */
import { isMachineAvailable } from "../inventory";
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
    it("defaults to 1 when settings doc is missing", async () => {
      mockSettingsInventory(null);
      mockOverlappingRentals([
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

    it("defaults to 1 when inventory field is missing on machine", async () => {
      mockSettingsInventory({});
      mockOverlappingRentals([
        { rentalDate: "2026-06-15", returnDate: "2026-06-15" },
      ]);

      const result = await isMachineAvailable(
        "double",
        30,
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
});
