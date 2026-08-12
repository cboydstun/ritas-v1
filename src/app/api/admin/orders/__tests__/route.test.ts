/**
 * @jest-environment node
 */
import { POST } from "../route";
import { PUT } from "../[id]/route";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { isMachineAvailable } from "@/lib/inventory";
import { getServerSession } from "next-auth";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

jest.mock("@/lib/inventory", () => ({
  isMachineAvailable: jest.fn(),
}));

jest.mock("@/models/settings", () => ({
  Settings: { findOne: jest.fn() },
}));

jest.mock("nanoid", () => ({ nanoid: () => "bookid1234" }));

const createdDocs: Record<string, unknown>[] = [];
jest.mock("@/models/rental", () => ({
  Rental: Object.assign(
    jest.fn().mockImplementation(function (
      this: Record<string, unknown>,
      doc: Record<string, unknown>,
    ) {
      createdDocs.push(doc);
      this.save = jest.fn().mockResolvedValue({ _id: "new-id", ...doc });
    }),
    {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    },
  ),
}));

const mockAvailable = isMachineAvailable as jest.MockedFunction<
  typeof isMachineAvailable
>;
const mockSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;

const futureDate = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const validOrder = (overrides: Record<string, unknown> = {}) => ({
  machineType: "double",
  selectedMixers: ["margarita"],
  selectedExtras: [],
  rentalDate: futureDate(10),
  rentalTime: "12:00",
  returnDate: futureDate(11),
  returnTime: "12:00",
  customer: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "(210) 555-0134",
    address: {
      street: "1 Alamo Plaza",
      city: "San Antonio",
      state: "TX",
      zipCode: "78205",
    },
  },
  notes: "",
  ...overrides,
});

const post = (body: Record<string, unknown>) =>
  POST(
    new Request("http://localhost:3000/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const VALID_ID = "507f1f77bcf86cd799439011";

const put = (body: Record<string, unknown>, id: string = VALID_ID) =>
  PUT(
    new Request(`http://localhost:3000/api/admin/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

const existingOrder = (overrides: Record<string, unknown> = {}) => ({
  _id: VALID_ID,
  machineType: "double",
  capacity: 30,
  selectedMixers: ["margarita"],
  selectedExtras: [],
  rentalDate: futureDate(10),
  returnDate: futureDate(11),
  status: "pending_payment",
  ...overrides,
});

const lastCreated = () => createdDocs[createdDocs.length - 1];

describe("admin order routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;
    mockSession.mockResolvedValue({
      user: { role: "admin", name: "admin" },
    } as never);
    mockAvailable.mockResolvedValue({ available: true });
    (Settings.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    (Rental.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(existingOrder()),
    });
    (Rental.findByIdAndUpdate as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: VALID_ID }),
    });
  });

  describe("POST", () => {
    it("rejects a caller who is not an admin", async () => {
      mockSession.mockResolvedValue(null);

      const response = await post(validOrder());

      expect(response.status).toBe(401);
    });

    // The PUT sibling has re-checked availability since admin edits were found
    // to oversell dates; POST had no check at all.
    it("returns 409 when the machine is already booked for those dates", async () => {
      mockAvailable.mockResolvedValue({
        available: false,
        reason: "All double tank machines are booked",
      });

      const response = await post(validOrder());

      expect(response.status).toBe(409);
      expect(Rental).not.toHaveBeenCalled();
    });

    it("skips the availability check for an order created as cancelled", async () => {
      const response = await post(validOrder({ status: "cancelled" }));

      expect(response.status).toBe(201);
      expect(mockAvailable).not.toHaveBeenCalled();
    });

    it.each([
      ["a missing rentalDate", { rentalDate: undefined }],
      ["a malformed rentalDate", { rentalDate: "01/02/2026" }],
      ["a missing returnDate", { returnDate: undefined }],
    ])("returns 400 for %s", async (_label, overrides) => {
      const response = await post(validOrder(overrides));

      expect(response.status).toBe(400);
      expect(Rental).not.toHaveBeenCalled();
    });

    it("returns 400 when the return date precedes the rental date", async () => {
      const response = await post(
        validOrder({ rentalDate: futureDate(11), returnDate: futureDate(10) }),
      );

      expect(response.status).toBe(400);
    });

    it("derives capacity and ignores a price from the body", async () => {
      const response = await post(
        validOrder({ machineType: "triple", capacity: 15, price: 1 }),
      );

      expect(response.status).toBe(201);
      expect(lastCreated().capacity).toBe(45);
      expect(lastCreated().price).toBeGreaterThan(1);
    });

    it("prices extras from the catalog and rejects unknown ids", async () => {
      const response = await post(
        validOrder({
          selectedExtras: [{ id: "not-a-real-extra", quantity: 1 }],
        }),
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("rejects a caller who is not an admin", async () => {
      mockSession.mockResolvedValue(null);

      const response = await put({ notes: "hello" });

      expect(response.status).toBe(401);
    });

    it("re-checks availability when the dates move", async () => {
      mockAvailable.mockResolvedValue({
        available: false,
        reason: "Fully booked",
      });

      // Both ends move together: shifting only rentalDate past the stored
      // returnDate is an inverted range, which the date guard below rejects
      // with a 400 before availability is ever consulted.
      const response = await put({
        rentalDate: futureDate(30),
        returnDate: futureDate(31),
      });

      expect(response.status).toBe(409);
      expect(Rental.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    // The POST handler validated both dates and their ordering; PUT did
    // neither. An inverted range made eachDayInRange return [], so
    // isMachineAvailable skipped both loops and reported available, and
    // Math.max(1, negative span) repriced a multi-day rental as one day.
    it.each([
      ["an inverted range", { returnDate: futureDate(5) }],
      ["a malformed rentalDate", { rentalDate: "06/15/2026" }],
      ["a range beyond MAX_RANGE_DAYS", { returnDate: futureDate(200) }],
    ])("rejects %s with a 400", async (_label, payload) => {
      const response = await put(payload);

      expect(response.status).toBe(400);
      expect(Rental.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    // Reviving a cancelled order puts a unit back on a date that may have
    // filled up while it was cancelled. Only machine/date edits used to count.
    it("re-checks availability when a cancelled order is revived", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(existingOrder({ status: "cancelled" })),
      });
      mockAvailable.mockResolvedValue({
        available: false,
        reason: "Fully booked",
      });

      const response = await put({ status: "confirmed" });

      expect(response.status).toBe(409);
      expect(Rental.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("does not re-check when a cancelled order stays cancelled", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(existingOrder({ status: "cancelled" })),
      });

      const response = await put({ status: "cancelled" });

      expect(response.status).toBe(200);
      expect(mockAvailable).not.toHaveBeenCalled();
    });

    // price was recomputed from *current* Settings on every PUT, so flipping
    // an old order's status — or marking its payment collected, which is the
    // same request shape — silently rewrote the total the customer was
    // invoiced for. Historical orders keep the price they were sold at.
    it("leaves price and payment.amount alone on a status-only edit", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingOrder({ price: 183.86 })),
      });

      const response = await put({ status: "completed" });

      expect(response.status).toBe(200);
      const [, update] = (Rental.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(update.price).toBeUndefined();
      expect(update["payment.amount"]).toBeUndefined();
    });

    it("pins a payment edit to the stored price, not the client's amount", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingOrder({ price: 183.86 })),
      });

      const response = await put({
        payment: { status: "completed", amount: 9.99, date: futureDate(1) },
      });

      expect(response.status).toBe(200);
      const [, update] = (Rental.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(update.price).toBeUndefined();
      expect(update.payment.amount).toBe(183.86);
    });

    it("still recomputes price when a pricing field moves", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          existingOrder({
            payment: { amount: 1, status: "pending", date: futureDate(1) },
          }),
        ),
      });

      const response = await put({ machineType: "triple" });

      expect(response.status).toBe(200);
      const [, update] = (Rental.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(update.price).toBeGreaterThan(0);
      expect(update["payment.amount"]).toBe(update.price);
    });

    // The dotted `payment.amount` $set on an order with no payment
    // subdocument created one with neither `status` nor `date`; update
    // validators skip absent paths, so the schema's `required` never fired.
    it("writes a complete payment subdocument when the order had none", async () => {
      const response = await put({ machineType: "triple" });

      expect(response.status).toBe(200);
      const [, update] = (Rental.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(update["payment.amount"]).toBeUndefined();
      expect(update.payment).toMatchObject({
        amount: update.price,
        status: "pending",
      });
      expect(update.payment.date).toBeInstanceOf(Date);
    });

    // An admin who deletes a custom mixer from Settings used to lock every
    // order that had booked it out of *every* edit: merged.selectedMixers
    // falls back to the stored value, so resolving it against the current
    // catalog 400'd on an id the caller never sent. The order could not even
    // be cancelled, and went on holding its unit.
    it("allows a status edit on an order whose mixer was since deleted", async () => {
      (Rental.findById as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue(
            existingOrder({ selectedMixers: ["blue-hawaiian"] }),
          ),
      });

      const response = await put({ status: "cancelled" });

      expect(response.status).toBe(200);
    });

    it("still rejects an unknown mixer the caller actually sent", async () => {
      const response = await put({ selectedMixers: ["blue-hawaiian"] });

      expect(response.status).toBe(400);
    });

    it("does not re-check on an edit that touches neither dates nor status", async () => {
      const response = await put({ notes: "Call on arrival" });

      expect(response.status).toBe(200);
      expect(mockAvailable).not.toHaveBeenCalled();
    });

    it("never writes a capacity or price taken from the body", async () => {
      await put({ machineType: "triple", capacity: 15, price: 1 });

      const [, update] = (Rental.findByIdAndUpdate as jest.Mock).mock.calls[0];
      expect(update.capacity).toBe(45);
      expect(update.price).toBeGreaterThan(1);
    });

    it("returns 404 for an id that is not a valid ObjectId", async () => {
      const response = await put({ notes: "x" }, "not-an-object-id");

      expect(response.status).toBe(404);
    });
  });
});
