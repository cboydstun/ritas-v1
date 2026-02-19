import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { useAvailabilityCheck } from "@/hooks/useAvailabilityCheck";

// Mock fetch globally - typed to avoid version mismatch issues with @jest/globals
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = jest.fn<() => Promise<any>>();
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("useAvailabilityCheck", () => {
  describe("Initial State", () => {
    it("returns isChecking as false initially", () => {
      const { result } = renderHook(() => useAvailabilityCheck());
      expect(result.current.isChecking).toBe(false);
    });

    it("returns availability as null initially", () => {
      const { result } = renderHook(() => useAvailabilityCheck());
      expect(result.current.availability).toBeNull();
    });

    it("returns error as null initially", () => {
      const { result } = renderHook(() => useAvailabilityCheck());
      expect(result.current.error).toBeNull();
    });

    it("exposes checkAvailability function", () => {
      const { result } = renderHook(() => useAvailabilityCheck());
      expect(typeof result.current.checkAvailability).toBe("function");
    });
  });

  describe("Fetching Availability", () => {
    it("fetches from the correct API endpoint", async () => {
      const mockData = {
        available: true,
        machineType: "single" as const,
        capacity: 15 as const,
        date: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/availability"),
      );
    });

    it("includes machineType in the request URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("machineType=single"),
      );
    });

    it("includes capacity in the request URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("capacity=15"),
      );
    });

    it("includes date in the request URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("date=2024-01-15"),
      );
    });
  });

  describe("Successful Response", () => {
    it("sets availability data on successful fetch", async () => {
      const mockData = {
        available: true,
        machineType: "single" as const,
        capacity: 15 as const,
        date: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.availability).toEqual(mockData);
    });

    it("sets isChecking to false after successful fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.isChecking).toBe(false);
    });

    it("keeps error as null on successful fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.error).toBeNull();
    });

    it("returns the availability data from checkAvailability", async () => {
      const mockData = {
        available: true,
        machineType: "double" as const,
        capacity: 30 as const,
        date: "2024-06-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      let returnValue: Awaited<
        ReturnType<typeof result.current.checkAvailability>
      >;
      await act(async () => {
        returnValue = await result.current.checkAvailability(
          "double",
          30,
          "2024-06-15",
        );
      });

      expect(returnValue!.available).toBe(true);
      expect(returnValue!.machineType).toBe("double");
    });
  });

  describe("Error Handling", () => {
    it("sets error when fetch returns non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest
          .fn()
          .mockResolvedValueOnce({ message: "Machine not available" }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.error).toBe("Machine not available");
    });

    it("sets isChecking to false after error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ message: "Error" }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.isChecking).toBe(false);
    });

    it("returns error object with available=false when fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest
          .fn()
          .mockResolvedValueOnce({ message: "Machine unavailable" }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      let returnValue: Awaited<
        ReturnType<typeof result.current.checkAvailability>
      >;
      await act(async () => {
        returnValue = await result.current.checkAvailability(
          "single",
          15,
          "2024-01-15",
        );
      });

      expect(returnValue!.available).toBe(false);
      expect(returnValue!.error).toBe("Machine unavailable");
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.isChecking).toBe(false);
    });

    it("sets unknown error message for non-Error rejection", async () => {
      mockFetch.mockRejectedValueOnce("unknown error");

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.error).toBe("An unknown error occurred");
    });

    it("resets error to null at start of new check", async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValueOnce({ message: "First error" }),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-15");
      });

      expect(result.current.error).toBe("First error");

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          available: true,
          machineType: "single",
          capacity: 15,
          date: "2024-01-15",
        }),
      });

      await act(async () => {
        await result.current.checkAvailability("single", 15, "2024-01-16");
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("Different Machine Types", () => {
    it("checks availability for double tank", async () => {
      const mockData = {
        available: true,
        machineType: "double" as const,
        capacity: 30 as const,
        date: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("double", 30, "2024-01-15");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("machineType=double"),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("capacity=30"),
      );
    });

    it("checks availability for triple tank", async () => {
      const mockData = {
        available: false,
        machineType: "triple" as const,
        capacity: 45 as const,
        date: "2024-01-15",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      });

      const { result } = renderHook(() => useAvailabilityCheck());

      await act(async () => {
        await result.current.checkAvailability("triple", 45, "2024-01-15");
      });

      expect(result.current.availability?.available).toBe(false);
    });
  });
});
