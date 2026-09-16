import mongoose from "mongoose";

import { PARTNER_EVENTS } from "@/lib/partner/payload";

/**
 * The outbox for order events pushed to bounce-v3.
 *
 * A row is written in the same request that commits the booking, and delivery
 * is attempted immediately afterwards. That ordering is the whole point: this
 * app has no queue and no job runner, and a booking that reaches the customer's
 * inbox but never reaches the shared calendar is how the crew ends up
 * double-committed on a Saturday.
 *
 * A failed send leaves the row `pending` for the sweep to retry — from the
 * daily cron, and opportunistically on the next booking, the same belt-and-
 * braces `createBooking` already applies to `releaseStaleHolds`.
 */

const outboundEventSchema = new mongoose.Schema(
  {
    /**
     * The receiver's idempotency key, and the reason a retry is safe.
     *
     * Minted once, here, and reused on every attempt — bounce-v3 dedupes on
     * this exact string. Re-minting per attempt is what breaks its own
     * PartyPad receiver, which derives a key from the signature and timestamp
     * and so never recognises a redelivery.
     */
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true, enum: PARTNER_EVENTS },
    /**
     * `Rental._id` as a string. The correlation key on both sides.
     *
     * Not `bookingId`: that field is not required on the Rental schema, so it
     * is not safe as a join key even though every emittable order has one.
     */
    partnerOrderId: { type: String, required: true, index: true },
    bookingId: { type: String },
    /**
     * Monotonic per order, so a replayed `created` cannot overwrite a newer
     * `cancelled`. `Date.now()` at enqueue: the receiver only compares, and
     * two events for one booking are never built in the same millisecond.
     */
    sequence: { type: Number, required: true },
    /**
     * The exact body to send, frozen at enqueue.
     *
     * Never re-derived at send time. A row replayed weeks later must carry the
     * prices the customer was actually charged, not whatever `Settings` says
     * today — the same reason the admin order routes stopped re-pricing on
     * every PUT.
     */
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    /**
     * The error's *name* only, via `safeErrorSummary`.
     *
     * Never `error.message`: a Mongoose validation or duplicate-key message
     * embeds the offending customer values, and `removeConsole` deliberately
     * keeps `console.error` alive in production.
     */
    lastError: { type: String },
    createdAt: { type: Date, default: Date.now },
    sentAt: { type: Date },
  },
  {
    collection: "outbound_events",
  },
);

// The sweep reads oldest-pending-first.
outboundEventSchema.index({ status: 1, createdAt: 1 });

export interface OutboundEventDocument extends mongoose.Document {
  eventId: string;
  event: string;
  partnerOrderId: string;
  bookingId?: string;
  sequence: number;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError?: string;
  createdAt: Date;
  sentAt?: Date;
}

const OutboundEvent =
  (mongoose.models.OutboundEvent as mongoose.Model<OutboundEventDocument>) ||
  mongoose.model<OutboundEventDocument>("OutboundEvent", outboundEventSchema);

export default OutboundEvent;
