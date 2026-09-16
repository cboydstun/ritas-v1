/**
 * @jest-environment node
 */
import crypto from "crypto";

/**
 * The outbox exists because this app has no queue and no job runner: a booking
 * that reaches the customer's inbox but never reaches the shared calendar is
 * how the crew ends up double-committed on a Saturday.
 *
 * Mocked at the model rather than run against mongodb-memory-server. This repo
 * keeps exactly one such exception, `deliveryZonesPersist`, and it earns it by
 * testing something only the raw collection can show. Nothing here needs that.
 */

const created: Array<Record<string, unknown>> = [];
const rows = new Map<string, Record<string, unknown>>();

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/outboundEvent", () => ({
  __esModule: true,
  default: {
    create: jest.fn(async (doc: Record<string, unknown>) => {
      created.push(doc);
      rows.set(doc.eventId as string, {
        // The schema defaults Mongoose would apply on hydration.
        attempts: 0,
        ...doc,
        save: jest.fn().mockResolvedValue(true),
      });
      return doc;
    }),
    findOne: jest.fn(async (filter: { eventId: string; status: string }) => {
      const row = rows.get(filter.eventId);
      if (!row || row.status !== filter.status) return null;
      return row;
    }),
    find: jest.fn(() => ({
      sort: () => ({
        limit: () => ({
          select: () => ({
            lean: async () =>
              [...rows.values()]
                .filter((r) => r.status === "pending")
                .map((r) => ({ eventId: r.eventId })),
          }),
        }),
      }),
    })),
  },
}));

// `after()` throws outside a request scope; the helpers fall back to inline.
jest.mock("next/server", () => ({
  __esModule: true,
  after: () => {
    throw new Error("no request scope");
  },
}));

import OutboundEvent from "@/models/outboundEvent";
import {
  emitPartnerEvent,
  enqueuePartnerEvent,
  partnerWebhookConfigured,
  sweepOutbox,
  MAX_SEND_ATTEMPTS,
} from "@/lib/partner/send";
import { computeOrderTotal } from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";

const URL_ = "https://bounce.example/api/v1/webhooks/partner-orders";
const SECRET = "partner-secret-for-tests";

const rental = {
  machineType: "triple",
  capacity: 45,
  selectedMixers: ["margarita"],
  selectedExtras: [],
  price: 0,
  rentalDate: "2026-10-04",
  rentalTime: "11:00",
  returnDate: "2026-10-05",
  returnTime: "11:00",
  customer: {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "2105551234",
    address: {
      street: "123 Alamo St",
      city: "San Antonio",
      state: "TX",
      zipCode: "78209",
    },
  },
  notes: "",
  isServiceDiscount: false,
} as unknown as OrderFormData;

function input() {
  return {
    event: "order.created" as const,
    partnerOrderId: "rental-1",
    bookingId: "AB3XY9",
    rental,
    totals: computeOrderTotal(rental),
    resolvedMixers: ["margarita"],
    mixerLabel: (id: string) => id,
    status: "pending_payment",
    paymentStatus: "pending",
    paymentMethod: "invoice" as const,
  };
}

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  created.length = 0;
  rows.clear();
  process.env.PARTNER_WEBHOOK_URL = URL_;
  process.env.PARTNER_WEBHOOK_SECRET = SECRET;
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  delete process.env.PARTNER_WEBHOOK_URL;
  delete process.env.PARTNER_WEBHOOK_SECRET;
});

describe("shipping dark", () => {
  it("does nothing at all when unconfigured", async () => {
    // Same contract the PayPal variables carry: unset means the feature is off
    // and checkout behaves exactly as it did before.
    delete process.env.PARTNER_WEBHOOK_URL;
    delete process.env.PARTNER_WEBHOOK_SECRET;

    expect(partnerWebhookConfigured()).toBe(false);

    await emitPartnerEvent(input());

    expect(OutboundEvent.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing with only half the configuration", async () => {
    delete process.env.PARTNER_WEBHOOK_SECRET;

    await emitPartnerEvent(input());

    expect(OutboundEvent.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("delivery", () => {
  it("signs the exact bytes it sends", async () => {
    await emitPartnerEvent(input());

    const [url, init] = fetchMock.mock.calls[0];
    const body = init.body as string;
    const expected = `sha256=${crypto.createHmac("sha256", SECRET).update(body).digest("hex")}`;

    expect(url).toBe(URL_);
    expect(init.headers["X-Webhook-Signature"]).toBe(expected);
    // Re-serializing the parsed object instead is how a genuine delivery
    // starts failing over key order.
    expect(JSON.parse(body).data.order.partnerOrderId).toBe("rental-1");
  });

  it("marks a row sent on a 2xx", async () => {
    await emitPartnerEvent(input());

    const row = [...rows.values()][0];
    expect(row.status).toBe("sent");
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it("treats a 409 as delivered", async () => {
    // The receiver saying it already has the event. The order is on the shared
    // calendar, which is the only thing the row exists to guarantee.
    fetchMock.mockResolvedValue({ ok: false, status: 409 });

    await emitPartnerEvent(input());

    expect([...rows.values()][0].status).toBe("sent");
  });

  it("keeps a row pending after a 5xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await emitPartnerEvent(input());

    const row = [...rows.values()][0];
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("HTTP_503");
  });

  it("keeps a row pending after a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));

    await emitPartnerEvent(input());

    expect([...rows.values()][0].status).toBe("pending");
  });

  it("gives up on a 4xx that is not 409", async () => {
    // The payload is frozen, so retrying it forever would burn the receiver's
    // own consecutive-failure budget over a message it can never accept.
    fetchMock.mockResolvedValue({ ok: false, status: 400 });

    await emitPartnerEvent(input());

    expect([...rows.values()][0].status).toBe("failed");
  });

  it("records only the error's name, never its message", async () => {
    // Mongoose validation and duplicate-key messages embed customer values,
    // and production builds keep console.error.
    fetchMock.mockRejectedValue(new TypeError("fetch failed for jane@x.com"));

    await emitPartnerEvent(input());

    expect([...rows.values()][0].lastError).toBe("TypeError");
  });
});

describe("the outbox row", () => {
  it("freezes the payload at enqueue", async () => {
    // A row replayed weeks later must carry the prices the customer was
    // actually charged, not whatever Settings says today.
    await enqueuePartnerEvent(input());

    const row = created[0];
    const payload = row.payload as { data: { order: { totals: unknown } } };

    expect(payload.data.order.totals).toBeDefined();
    expect(row.status).toBe("pending");
    expect(row.partnerOrderId).toBe("rental-1");
  });

  it("reuses one event id across every retry", async () => {
    // bounce-v3 dedupes on this exact string. Re-minting per attempt is what
    // breaks its own PartyPad receiver.
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await emitPartnerEvent(input());

    const eventId = created[0].eventId as string;
    const sentBodies = () =>
      fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string).id);

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    await sweepOutbox();

    expect(created).toHaveLength(1);
    expect(new Set(sentBodies())).toEqual(new Set([eventId]));
    expect([...rows.values()][0].status).toBe("sent");
  });

  it("stops retrying after the attempt ceiling", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await emitPartnerEvent(input());
    for (let i = 1; i < MAX_SEND_ATTEMPTS; i += 1) {
      await sweepOutbox();
    }

    const row = [...rows.values()][0];
    expect(row.attempts).toBe(MAX_SEND_ATTEMPTS);
    expect(row.status).toBe("failed");
  });
});

describe("the sweep", () => {
  it("delivers a row an earlier attempt could not", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    await emitPartnerEvent(input());
    expect([...rows.values()][0].status).toBe("pending");

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const delivered = await sweepOutbox();

    expect(delivered).toBe(1);
    expect([...rows.values()][0].status).toBe("sent");
  });

  it("is a no-op when unconfigured", async () => {
    delete process.env.PARTNER_WEBHOOK_URL;

    expect(await sweepOutbox()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
