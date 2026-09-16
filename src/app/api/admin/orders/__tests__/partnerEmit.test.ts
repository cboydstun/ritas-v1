/**
 * @jest-environment node
 */
import { GET, PUT, DELETE } from "../[id]/route";
import { Rental } from "@/models/rental";
import { getServerSession } from "next-auth";
import { schedulePartnerEvent } from "@/lib/partner/send";

/**
 * Which handler emits, and which must not.
 *
 * Shipped wrong once: the emit landed in GET instead of PUT, so merely opening
 * an order in the admin pushed an event to bounce-v3 while an actual status
 * change pushed nothing. Both halves were invisible — the write still
 * persisted, the read still returned the order, and nothing failed. Only the
 * mirror going stale gave it away, in production.
 *
 * So this asserts the negative as loudly as the positive.
 */

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/inventory", () => ({ isMachineAvailable: jest.fn() }));
jest.mock("@/models/settings", () => ({
  Settings: { findOne: jest.fn(() => ({ lean: () => Promise.resolve(null) })) },
}));

jest.mock("@/lib/partner/send", () => ({
  schedulePartnerEvent: jest.fn(),
  schedulePartnerSweep: jest.fn(),
}));

jest.mock("@/models/rental", () => ({
  Rental: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockEmit = schedulePartnerEvent as jest.MockedFunction<
  typeof schedulePartnerEvent
>;

const ID = "507f1f77bcf86cd799439011";

function order(overrides: Record<string, unknown> = {}) {
  return {
    _id: ID,
    bookingId: "Z4KRDX5GLD",
    machineType: "triple",
    capacity: 45,
    selectedMixers: ["margarita"],
    selectedExtras: [],
    price: 318.6,
    rentalDate: "2026-12-15",
    rentalTime: "11:00",
    returnDate: "2026-12-16",
    returnTime: "14:00",
    status: "confirmed",
    payment: { status: "pending" },
    customer: {
      name: "Test",
      email: "test@example.com",
      phone: "2105551234",
      address: {
        street: "1 Test St",
        city: "San Antonio",
        state: "TX",
        zipCode: "78209",
      },
    },
    ...overrides,
  };
}

const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { role: "admin" } } as never);
});

describe("reading an order", () => {
  it("emits nothing", async () => {
    // A GET is not a change. Emitting here pushes an event every time anyone
    // opens the order, and says nothing about whether it actually moved.
    (Rental.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(order()),
    });

    const response = await GET(
      new Request(`http://localhost/api/admin/orders/${ID}`),
      params,
    );

    expect(response.status).toBe(200);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe("updating an order", () => {
  function mockUpdate(doc: Record<string, unknown>) {
    // `PUT` reads the existing order with `.lean()` before merging the edit.
    (Rental.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(order()),
    });
    (Rental.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(doc),
    });
  }

  it("emits order.updated", async () => {
    mockUpdate(order({ status: "confirmed" }));

    await PUT(
      new Request(`http://localhost/api/admin/orders/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ status: "confirmed" }),
      }),
      params,
    );

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      event: "order.updated",
      partnerOrderId: ID,
      bookingId: "Z4KRDX5GLD",
      status: "confirmed",
    });
  });

  it("emits order.cancelled when the new status is cancelled", async () => {
    mockUpdate(order({ status: "cancelled" }));

    await PUT(
      new Request(`http://localhost/api/admin/orders/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      }),
      params,
    );

    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      event: "order.cancelled",
      status: "cancelled",
    });
  });

  it("sends no money, so a status flip cannot re-price the mirror", async () => {
    mockUpdate(order({ status: "confirmed" }));

    await PUT(
      new Request(`http://localhost/api/admin/orders/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ status: "confirmed" }),
      }),
      params,
    );

    const payload = mockEmit.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("totals");
    expect(payload).not.toHaveProperty("resolvedMixers");
  });
});

describe("deleting an order", () => {
  it("emits order.cancelled, never a delete", async () => {
    // bounce-v3's copy is a record of a booking that occupied the truck; the
    // books have to keep it.
    (Rental.findByIdAndDelete as jest.Mock).mockResolvedValue(
      order({ status: "confirmed" }),
    );

    await DELETE(
      new Request(`http://localhost/api/admin/orders/${ID}`, {
        method: "DELETE",
      }),
      params,
    );

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      event: "order.cancelled",
      status: "cancelled",
    });
  });
});
