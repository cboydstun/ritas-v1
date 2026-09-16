import crypto from "crypto";
import { after } from "next/server";

import { safeErrorSummary } from "@/lib/safe-error";
import {
  buildOrderPayload,
  buildStatusPayload,
  type BuildPayloadInput,
  type PartnerOrderPayload,
  type PartnerEvent,
  type PartnerRentalLike,
} from "@/lib/partner/payload";

/**
 * Delivery of order events to bounce-v3.
 *
 * Shaped after `lib/paypal/client.ts`, which is this repo's richer outbound
 * pattern: credentials read from `process.env` at call time rather than module
 * scope, a real `AbortSignal.timeout` rather than a race that leaves the
 * request running, and failures logged through `safeErrorSummary` under a
 * greppable marker.
 *
 * **Unconfigured is a no-op, never an error.** With neither variable set the
 * feature ships dark and checkout behaves exactly as it did before, the same
 * contract the PayPal variables carry.
 */

/**
 * Pulled in on demand, never at module scope.
 *
 * `lib/mongodb` throws at import when `MONGODB_URI` is absent, and this module
 * is reachable from the cron route and from `capturePayPalBooking`. A top-level
 * import would take those down at load time — in the CI build, which runs
 * against a deliberately unreachable database, and in any test that does not
 * think it is touching Mongo.
 */
async function db() {
  const [{ default: dbConnect }, { default: OutboundEvent }] =
    await Promise.all([
      import("@/lib/mongodb"),
      import("@/models/outboundEvent"),
    ]);
  await dbConnect();
  return OutboundEvent;
}

const SEND_TIMEOUT_MS = 10_000;

/** After this many failures a row stops being retried and needs a human. */
export const MAX_SEND_ATTEMPTS = 10;

/** How many pending rows one opportunistic sweep will attempt. */
export const SWEEP_LIMIT = 5;

export function partnerWebhookConfigured(): boolean {
  return Boolean(
    process.env.PARTNER_WEBHOOK_URL && process.env.PARTNER_WEBHOOK_SECRET,
  );
}

/**
 * Sign the exact bytes that go on the wire.
 *
 * `sha256=<hex>` over the serialized body, matching what bounce-v3's
 * `matchesHmac` computes. Signing a re-serialization of the parsed object
 * instead is how a genuine delivery starts failing over key order.
 */
function sign(body: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

type DeliveryOutcome =
  { delivered: true } | { delivered: false; terminal: boolean; reason: string };

async function deliver(payload: unknown): Promise<DeliveryOutcome> {
  const url = process.env.PARTNER_WEBHOOK_URL;
  const secret = process.env.PARTNER_WEBHOOK_SECRET;

  if (!url || !secret) {
    return { delivered: false, terminal: false, reason: "NotConfigured" };
  }

  const body = JSON.stringify(payload);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sign(body, secret),
      },
      body,
      // A real cancellation, unlike `withTimeout`, which leaves the request in
      // flight after it resolves.
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      delivered: false,
      terminal: false,
      reason: safeErrorSummary(error).name,
    };
  }

  if (response.ok) return { delivered: true };

  // 409 is the receiver saying it already has this event. From the outbox's
  // point of view that is success: the order is on the shared calendar, which
  // is the only thing the row exists to guarantee.
  if (response.status === 409) return { delivered: true };

  // Everything else in the 4xx range is about the payload, and the payload is
  // frozen — retrying it forever would burn the receiver's own
  // consecutive-failure budget over a message that can never be accepted.
  const terminal = response.status >= 400 && response.status < 500;

  return { delivered: false, terminal, reason: `HTTP_${response.status}` };
}

export type EnqueueInput = Omit<BuildPayloadInput, "eventId" | "sequence">;

/** A status or payment change: no money, because there is none to send. */
export interface StatusEnqueueInput {
  event: PartnerEvent;
  partnerOrderId: string;
  bookingId?: string;
  rental: PartnerRentalLike;
  status: string;
  paymentStatus: string;
  paymentMethod: "paypal" | "invoice" | "cash";
}

/**
 * Write the outbox row for an order event.
 *
 * Call it **after** the write it describes has committed and survived any
 * compensating delete — a row enqueued before the oversell rollback would
 * advertise a booking that no longer exists.
 *
 * Never throws. The booking is already committed by the time this runs, and an
 * escape here would tell a customer their booking failed when it did not — the
 * same contract `sendBookingNotifications` keeps.
 */
export async function enqueuePartnerEvent(
  input: EnqueueInput | StatusEnqueueInput,
): Promise<PartnerOrderPayload | null> {
  if (!partnerWebhookConfigured()) return null;

  try {
    const identity = {
      // `crypto.randomUUID`, not nanoid. Nothing here needs a short id, and
      // nanoid is ESM-only: pulling it into this module puts it in the import
      // graph of `capturePayPalBooking`, whose route tests then fail to load.
      eventId: `evt_${crypto.randomUUID()}`,
      sequence: Date.now(),
    };
    const payload =
      "totals" in input
        ? buildOrderPayload({ ...input, ...identity })
        : buildStatusPayload({ ...input, ...identity });

    const OutboundEvent = await db();
    await OutboundEvent.create({
      eventId: payload.id,
      event: payload.type,
      partnerOrderId: input.partnerOrderId,
      bookingId: input.bookingId,
      sequence: payload.sequence,
      // Cast because the schema types this `Mixed`; the payload is a plain
      // JSON object by construction.
      payload: payload as unknown as Record<string, unknown>,
      status: "pending",
    });

    return payload;
  } catch (error) {
    console.error("PARTNER_ENQUEUE_FAILED", {
      partnerOrderId: input.partnerOrderId,
      event: input.event,
      reason: safeErrorSummary(error).name,
    });
    return null;
  }
}

/**
 * Attempt one outbox row and record what happened.
 *
 * Never throws, for the same reason `enqueuePartnerEvent` does not.
 */
async function attempt(eventId: string): Promise<boolean> {
  try {
    const OutboundEvent = await db();
    const row = await OutboundEvent.findOne({ eventId, status: "pending" });
    if (!row) return false;

    const outcome = await deliver(row.payload);

    if (outcome.delivered) {
      row.status = "sent";
      row.sentAt = new Date();
      row.attempts = (row.attempts ?? 0) + 1;
      await row.save();
      return true;
    }

    // Coalesced rather than incremented blind: a row written by anything that
    // skipped the schema default would otherwise go NaN, and NaN never reaches
    // the ceiling below, so the row would retry forever without ever failing.
    row.attempts = (row.attempts ?? 0) + 1;
    row.lastError = outcome.reason;
    if (outcome.terminal || row.attempts >= MAX_SEND_ATTEMPTS) {
      row.status = "failed";
      console.error("PARTNER_WEBHOOK_FAILED", {
        eventId,
        bookingId: row.bookingId,
        attempts: row.attempts,
        reason: outcome.reason,
        terminal: outcome.terminal,
      });
    }
    await row.save();
    return false;
  } catch (error) {
    console.error("PARTNER_WEBHOOK_FAILED", {
      eventId,
      reason: safeErrorSummary(error).name,
    });
    return false;
  }
}

/**
 * Enqueue an event and try to deliver it immediately.
 *
 * The caller wraps this in `after()` so the serverless function stays alive
 * past the response; a bare floating promise is dropped when the function
 * freezes.
 */
export async function emitPartnerEvent(
  input: EnqueueInput | StatusEnqueueInput,
): Promise<void> {
  const payload = await enqueuePartnerEvent(input);
  if (!payload) return;

  await attempt(payload.id);
}

/**
 * Retry rows an earlier attempt could not deliver.
 *
 * Called from the daily cron and opportunistically after a booking. The
 * opportunistic call is what makes recovery minutes rather than a day under
 * any traffic at all — this app is on the Vercel Hobby plan, where nothing
 * more frequent than a daily cron is available.
 */
export async function sweepOutbox(limit = SWEEP_LIMIT): Promise<number> {
  if (!partnerWebhookConfigured()) return 0;

  try {
    const OutboundEvent = await db();
    const rows = await OutboundEvent.find({ status: "pending" })
      .sort({ createdAt: 1 })
      .limit(limit)
      .select("eventId")
      .lean<Array<{ eventId: string }>>();

    let delivered = 0;
    for (const row of rows) {
      // Serial rather than parallel: the receiver orders by `sequence`, and a
      // burst of concurrent posts is the one thing that could land two events
      // for the same booking out of order.
      if (await attempt(row.eventId)) delivered += 1;
    }

    return delivered;
  } catch (error) {
    console.error("PARTNER_SWEEP_FAILED", {
      reason: safeErrorSummary(error).name,
    });
    return 0;
  }
}

/**
 * Hand an event to the runtime to deliver after the response has gone out.
 *
 * `after()` is what keeps the serverless function alive until the post
 * completes; a bare floating promise is dropped the moment the function
 * freezes after responding, which on Vercel is immediately.
 *
 * Wrapped because `after()` throws outside a request scope — a script or a
 * test calling one of these paths directly should still work, just inline.
 */
export function schedulePartnerEvent(
  input: EnqueueInput | StatusEnqueueInput,
): void {
  if (!partnerWebhookConfigured()) return;

  try {
    after(() => emitPartnerEvent(input));
  } catch {
    // No request scope. Deliver inline and swallow, since every caller is
    // already past the write it is describing.
    void emitPartnerEvent(input);
  }
}

/**
 * Retry a few stalled rows after the response, alongside whatever was just
 * emitted.
 *
 * The daily cron is the floor; this is what makes recovery minutes rather than
 * a day whenever the site has any traffic at all. It mirrors `createBooking`
 * calling `releaseStaleHolds` inline rather than trusting the same cron.
 */
export function schedulePartnerSweep(): void {
  if (!partnerWebhookConfigured()) return;

  try {
    after(() => sweepOutbox());
  } catch {
    void sweepOutbox();
  }
}
