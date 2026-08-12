/**
 * @jest-environment node
 */
import { GET } from "../route";
import { isMachineAvailable } from "@/lib/inventory";

jest.mock("@/lib/inventory", () => ({
  isMachineAvailable: jest.fn(),
}));

const mockAvailable = isMachineAvailable as jest.MockedFunction<
  typeof isMachineAvailable
>;

const get = (query: string) =>
  GET(new Request(`http://localhost:3000/api/v1/availability?${query}`));

describe("GET /api/v1/availability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailable.mockResolvedValue({ available: true });
  });

  // The overlap query filters by capacity while inventory is keyed off
  // machineType alone, so a mismatched pair matched no existing rentals and
  // reported a fully booked date as available.
  it("derives capacity from machineType and ignores the query value", async () => {
    const response = await get(
      "machineType=triple&capacity=15&date=2026-09-01",
    );

    expect(response.status).toBe(200);
    expect(mockAvailable).toHaveBeenCalledWith(
      "triple",
      45,
      "2026-09-01",
      undefined,
    );
    await expect(response.json()).resolves.toMatchObject({ capacity: 45 });
  });

  it.each([
    ["single", 15],
    ["double", 30],
    ["triple", 45],
  ])("pairs %s with capacity %i", async (machineType, capacity) => {
    await get(`machineType=${machineType}&date=2026-09-01`);

    expect(mockAvailable).toHaveBeenCalledWith(
      machineType,
      capacity,
      "2026-09-01",
      undefined,
    );
  });

  it("no longer requires the capacity parameter", async () => {
    const response = await get("machineType=double&date=2026-09-01");

    expect(response.status).toBe(200);
  });

  it("passes the return date through when one is given", async () => {
    await get("machineType=double&date=2026-09-01&returnDate=2026-09-03");

    expect(mockAvailable).toHaveBeenCalledWith(
      "double",
      30,
      "2026-09-01",
      "2026-09-03",
    );
  });

  it("reports the reason when the machine is booked", async () => {
    mockAvailable.mockResolvedValue({
      available: false,
      reason: "All double tank machines are booked for 2026-09-01",
    });

    const response = await get("machineType=double&date=2026-09-01");

    await expect(response.json()).resolves.toMatchObject({
      available: false,
      reason: "All double tank machines are booked for 2026-09-01",
    });
  });

  describe("rejects bad input", () => {
    it.each([
      ["a missing machineType", "date=2026-09-01"],
      ["a missing date", "machineType=double"],
      ["an unknown machineType", "machineType=quadruple&date=2026-09-01"],
      ["a malformed date", "machineType=double&date=09/01/2026"],
      [
        "a malformed returnDate",
        "machineType=double&date=2026-09-01&returnDate=nope",
      ],
      [
        "a returnDate before the date",
        "machineType=double&date=2026-09-02&returnDate=2026-09-01",
      ],
      // The range is expanded day by day, so an unbounded span burns seconds
      // of CPU per anonymous request.
      [
        "a range longer than the cap",
        "machineType=double&date=2026-01-01&returnDate=2027-01-01",
      ],
    ])("%s", async (_label, query) => {
      const response = await get(query);

      expect(response.status).toBe(400);
      expect(mockAvailable).not.toHaveBeenCalled();
    });
  });
});
