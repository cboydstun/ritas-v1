/**
 * @jest-environment node
 */
import { GET } from "../route";
import { NextResponse } from "next/server";
import { Settings } from "@/models/settings";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/settings", () => ({
  Settings: {
    findOne: jest.fn(),
  },
}));

const mockPublicSettings = {
  fees: {
    deliveryFee: 20,
    salesTaxRate: 0.0825,
    processingFeeRate: 0.03,
    serviceDiscountRate: 0.1,
  },
  machines: {
    single: { basePrice: 124.95 },
    double: { basePrice: 149.95 },
    triple: { basePrice: 175.95 },
  },
  mixers: {
    "non-alcoholic": { price: 19.95 },
    margarita: { price: 19.95 },
    "pina-colada": { price: 24.95 },
    "strawberry-daiquiri": { price: 24.95 },
  },
  extras: {
    "table-chairs": { price: 19.95 },
    "cotton-candy": { price: 49.95 },
    "bounce-castle": { price: 99.95 },
    "popcorn-machine": { price: 49.95 },
  },
  operations: {
    deliveryWindowStartHour: 8,
    deliveryWindowEndHour: 18,
  },
};

describe("GET /api/v1/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with defaults when no document exists", async () => {
    (Settings.findOne as jest.Mock).mockResolvedValue({
      ...mockPublicSettings,
      key: "global",
      updatedBy: "",
      _id: "mock-id",
      toObject: () => ({
        ...mockPublicSettings,
        key: "global",
        updatedBy: "",
        _id: "mock-id",
      }),
    });

    const response = await GET();

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fees.deliveryFee).toBe(20);
    expect(data.fees.salesTaxRate).toBe(0.0825);
    expect(data.operations.deliveryWindowStartHour).toBe(8);
  });

  it("returns 200 with stored settings when document exists", async () => {
    const storedDoc = {
      ...mockPublicSettings,
      fees: { ...mockPublicSettings.fees, deliveryFee: 35 },
      key: "global",
      updatedBy: "admin@example.com",
      _id: "mock-id",
    };
    (Settings.findOne as jest.Mock).mockResolvedValue({
      ...storedDoc,
      toObject: () => storedDoc,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fees.deliveryFee).toBe(35);
  });

  it("response shape only includes public fields", async () => {
    const fullDoc = {
      ...mockPublicSettings,
      key: "global",
      updatedBy: "admin@example.com",
      _id: "some-mongo-id",
      __v: 0,
    };
    (Settings.findOne as jest.Mock).mockResolvedValue({
      ...fullDoc,
      toObject: () => fullDoc,
    });

    const response = await GET();
    const data = await response.json();

    // Should have public fields
    expect(data.fees).toBeDefined();
    expect(data.machines).toBeDefined();
    expect(data.mixers).toBeDefined();
    expect(data.extras).toBeDefined();
    expect(data.operations).toBeDefined();

    // Should NOT have private fields
    expect(data.updatedBy).toBeUndefined();
    expect(data._id).toBeUndefined();
    expect(data.key).toBeUndefined();
    expect(data.__v).toBeUndefined();
  });
});
