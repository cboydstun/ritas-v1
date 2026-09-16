/**
 * @jest-environment node
 */
import OutboundEvent from "@/models/outboundEvent";

/**
 * Offline `doc.validate()`, like every model test here except the one
 * deliberate `deliveryZonesPersist` exception.
 *
 * What is worth pinning is the small set of fields a retry depends on: an
 * event id that cannot repeat, a status the sweep can select on, and an
 * attempt counter that starts at a number rather than at undefined.
 */

function row(overrides: Record<string, unknown> = {}) {
  return new OutboundEvent({
    eventId: "evt_1",
    event: "order.created",
    partnerOrderId: "rental-1",
    bookingId: "AB3XY9",
    sequence: 1_700_000_000_000,
    payload: { id: "evt_1" },
    ...overrides,
  });
}

describe("OutboundEvent", () => {
  it("accepts a well-formed row", async () => {
    await expect(row().validate()).resolves.toBeUndefined();
  });

  it("starts pending with a zeroed attempt count", () => {
    // `attempts` must default to a number: the send path increments it and
    // compares against a ceiling, and undefined + 1 is NaN, which never
    // reaches any ceiling at all.
    const doc = row();

    expect(doc.status).toBe("pending");
    expect(doc.attempts).toBe(0);
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it.each(["eventId", "event", "partnerOrderId", "sequence", "payload"])(
    "requires %s",
    async (field) => {
      await expect(row({ [field]: undefined }).validate()).rejects.toThrow();
    },
  );

  it("refuses an event type the receiver does not handle", async () => {
    await expect(row({ event: "order.exploded" }).validate()).rejects.toThrow();
  });

  it("refuses a status the sweep does not select on", async () => {
    await expect(row({ status: "queued" }).validate()).rejects.toThrow();
  });
});
