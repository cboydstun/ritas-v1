import twilio from "twilio";
import { Resend } from "resend";
import { mixerDetails } from "@/lib/rental-data";
import { formatPrice } from "@/lib/pricing";
import { safeErrorSummary } from "@/lib/safe-error";
import { escapeHtml } from "@/lib/validation";
import { withTimeout, NOTIFICATION_TIMEOUT_MS } from "@/lib/with-timeout";
import type { OrderTotals } from "@/components/order/utils";

/**
 * The subset of a persisted rental the notifications read.
 *
 * Deliberately structural rather than `RentalDocument`: the capture route
 * hands this the document it loaded back out of Mongo, and the booking routes
 * hand it the one they just constructed. Neither is worth a cast.
 */
export interface RentalLike {
  machineType: string;
  capacity: number;
  rentalDate: string;
  rentalTime: string;
  returnDate: string;
  returnTime: string;
  selectedExtras?: { name: string; quantity?: number }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
}

/**
 * How the booking was paid for, which is the only thing that differs between
 * the sends.
 *
 * `paid: false` is the invoice path. `paid: true` is a PayPal capture — but a
 * capture is not automatically a settled one: PayPal holds eCheck and
 * risk-reviewed funds as `PENDING`, and a captured figure can disagree with the
 * price the booking was sold at. Both of those moved the buyer's money, so
 * neither may be reported as an invoice; neither may be reported as done
 * either. `settled` is that distinction, and it reaches the customer — a
 * booking they have paid for and heard nothing about is the worst of the three.
 */
export type BookingPayment =
  | { paid: false }
  | {
      paid: true;
      /** False while PayPal is clearing, or when the captured figure differs. */
      settled: boolean;
      transactionId: string;
      method: "paypal";
      /** What PayPal actually took, when it is not the booking total. */
      capturedAmount?: number;
    };

export interface BookingNotificationInput {
  rental: RentalLike;
  bookingId: string;
  totals: OrderTotals;
  rates: { taxRate: number; processingRate: number };
  /** Display label for a mixer id, including admin-added flavours. */
  mixerLabel: (id: string) => string;
  resolvedMixers: string[];
  payment: BookingPayment;
}

/** Render a rate like 0.0825 as "8.25%" so labels track the real settings. */
export const pct = (rate: number): string =>
  `${Number((rate * 100).toFixed(4))}%`;

/**
 * "14:00" → "2:00 PM". The delivery-window picker defaults to the "ANY"
 * sentinel, which the old formatter fed to parseInt and rendered as the
 * nonsense "12:undefined AM" in every operator SMS.
 */
export function formatDeliveryTime(time: string): string {
  if (!time || time === "ANY") return "Any Time";

  const [hourPart, minutePart] = time.split(":");
  const hour24 = parseInt(hourPart, 10);
  if (!Number.isFinite(hour24) || !minutePart) return "Any Time";

  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutePart} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/**
 * Operator SMS and customer confirmation email for a booking that has already
 * been written.
 *
 * **Never throws.** Both channels are fire-and-log: the rental is committed by
 * the time this runs and stands either way, so an escape here would tell a
 * customer their booking failed when it did not. Each channel carries its own
 * try/catch for the same reason — `twilio()` throws synchronously on a
 * malformed SID and the `Resend` constructor throws when `RESEND_API_KEY` is
 * unset, both before any promise exists to reject.
 */
export async function sendBookingNotifications(
  input: BookingNotificationInput,
): Promise<void> {
  const {
    rental,
    bookingId,
    totals,
    rates,
    mixerLabel,
    resolvedMixers,
    payment,
  } = input;

  const {
    basePrice,
    mixerPrice,
    deliveryFee,
    perDayRate,
    rentalDays,
    extrasTotal: emailExtrasTotal,
    subtotal: emailSubtotal,
    salesTax: emailSalesTax,
    processingFee: emailProcessingFee,
    cashPrice: emailCashPrice,
    finalTotal: emailTotal,
  } = totals;
  const { taxRate, processingRate } = rates;

  // Holds the in-flight Twilio send so it can overlap the Resend call
  // below rather than serialising with it.
  let smsInFlight: Promise<unknown> | null = null;

  // Send SMS notification if Twilio credentials are configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  const toPhone = process.env.USER_PHONE_NUMBER;

  if (accountSid && authToken && fromPhone && toPhone) {
    try {
      // Inside the try: twilio() throws synchronously on a malformed SID,
      // and the rental is already persisted at this point — an escape here
      // returns a 500 for a booking that actually succeeded.
      const twilioClient = twilio(accountSid, authToken);
      // Parse the rental date and time
      const [year, month, day] = rental.rentalDate.split("-");
      const rentalDateTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
      );

      // Format the date and time
      const formattedDate = rentalDateTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      const formattedTime = formatDeliveryTime(rental.rentalTime);

      // Prepare extras text if any
      const extrasText =
        rental.selectedExtras && rental.selectedExtras.length > 0
          ? `Extras: ${rental.selectedExtras
              .map(
                (extra: { name: string; quantity?: number }) =>
                  `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
              )
              .join(", ")}\n`
          : "";

      // The operator acts on this message. Telling them to invoice a customer
      // who has already paid is how a paid booking gets billed twice.
      const headline = !payment.paid
        ? "🎉 NEW BOOKING - PAYMENT PENDING"
        : payment.settled
          ? "🎉 NEW BOOKING - PAID"
          : "⚠️ NEW BOOKING - PAYMENT NEEDS REVIEW";
      const footer = !payment.paid
        ? "⚠️ INVOICE CUSTOMER FOR PAYMENT"
        : payment.settled
          ? `✅ PAID IN FULL VIA PAYPAL\nTxn: ${payment.transactionId}`
          : `⚠️ PAYPAL CAPTURE NOT SETTLED - CHECK BEFORE DISPATCH\nTxn: ${payment.transactionId}` +
            (payment.capturedAmount === undefined
              ? ""
              : `\nTook $${formatPrice(payment.capturedAmount)} against $${formatPrice(emailTotal)}`);

      // Started, not awaited. Both notifications are fire-and-log — the
      // booking is already committed and stands either way — but awaiting
      // them one after the other made the customer wait up to two full
      // NOTIFICATION_TIMEOUT_MS windows after their booking had succeeded.
      // The result is collected alongside the email below.
      smsInFlight = withTimeout(
        twilioClient.messages.create({
          body:
            `${headline}\n` +
            `Booking ID: ${bookingId}\n` +
            `Date: ${formattedDate}\n` +
            `Time: ${formattedTime}\n` +
            `Address: ${rental.customer.address.street}, ${rental.customer.address.city}, ${rental.customer.address.state} ${rental.customer.address.zipCode}\n` +
            `Machine: ${rental.machineType}\n` +
            `Mixers: ${resolvedMixers.map(mixerLabel).join(", ") || "None"}\n` +
            `${extrasText}` +
            `Customer: ${rental.customer.name}\n` +
            `Phone: ${rental.customer.phone}\n` +
            `Total: $${emailTotal.toFixed(2)}\n` +
            footer,
          from: fromPhone,
          to: toPhone,
        }),
        NOTIFICATION_TIMEOUT_MS,
        "Twilio",
      );
    } catch (smsError) {
      console.error("Error sending SMS:", safeErrorSummary(smsError));
      // Continue with order processing even if SMS fails
    }
  } else {
    console.warn(
      "Twilio credentials not fully configured - skipping SMS notification",
    );
  }

  // ── Build dynamic mixer & drink guide for the confirmation email ──────
  const tankCount =
    rental.machineType === "single"
      ? 1
      : rental.machineType === "double"
        ? 2
        : 3;
  const selectedMixers: string[] = resolvedMixers;

  const tankRows = Array.from({ length: tankCount }, (_, i) => {
    const mixerKey = selectedMixers[i] as keyof typeof mixerDetails | undefined;
    const tankLabel = tankCount === 1 ? "Your Tank" : `Tank ${i + 1}`;

    if (mixerKey) {
      const name = escapeHtml(mixerLabel(mixerKey));
      return `
          <li style="margin-bottom: 12px; padding: 10px; background: #f0fdf4; border-left: 3px solid #22c55e; border-radius: 4px;">
            <strong>${tankLabel} — ${name}</strong><br/>
            <span style="font-size: 14px; color: #444; line-height: 1.7;">
              ✅ <strong>We bring:</strong> 1 × ½-gallon (64 oz) jug of ${name} concentrate<br/>
              💧 <strong>You add:</strong> ~2 gallons of water → ~2.5 gallons total (~40 servings of 8 oz)<br/>
              🥃 <strong>Optional BYOB:</strong> up to 1.75 L (one "handle") of liquor per tank if desired
            </span>
          </li>`;
    }

    return `
        <li style="margin-bottom: 12px; padding: 10px; background: #f9fafb; border-left: 3px solid #d1d5db; border-radius: 4px;">
          <strong>${tankLabel} — No Mixer Selected</strong><br/>
          <span style="font-size: 14px; color: #444;">
            You will be providing your own mixer and water. Each tank holds up to 1.75 L of liquor if desired.
          </span>
        </li>`;
  }).join("");

  const mixerGuideHtml = `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin: 0 0 12px 0; color: #1d4ed8;">🍹 Your Mixer &amp; Drink Preparation Guide</h3>
        <ul style="list-style-type: none; padding: 0; margin: 0 0 14px 0;">
          ${tankRows}
        </ul>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px;">
          <strong style="color: #92400e;">🚫 Alcohol Policy — Texas TABC</strong><br/>
          <span style="font-size: 14px; color: #78350f; line-height: 1.6;">
            We are prohibited by Texas law from providing or selling alcohol.
            Many of our customers choose to add their own — if you do, please limit to
            <strong>one 1.75 L bottle (a "handle") per tank maximum</strong>
            and always <strong>drink responsibly</strong>. 🥃
          </span>
        </div>
      </div>`;
  // ─────────────────────────────────────────────────────────────────────

  const pricingBreakdownHtml = `
      <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px 0;"><strong style="color: #2b6cb0;">Pricing Breakdown:</strong></p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; color: #555;">Machine (${rental.capacity}L ${rental.machineType}):</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(basePrice)}/day</td>
          </tr>
          ${
            mixerPrice > 0
              ? `<tr>
            <td style="padding: 5px 0; color: #555;">${resolvedMixers.length} Mixer${resolvedMixers.length > 1 ? "s" : ""}:</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(mixerPrice)}/day</td>
          </tr>`
              : ""
          }
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 5px 0; color: #555;">Rate × ${rentalDays} day${rentalDays > 1 ? "s" : ""}:</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(perDayRate * rentalDays)}</td>
          </tr>
          ${
            emailExtrasTotal > 0
              ? `<tr>
            <td style="padding: 5px 0; color: #555;">Party Extras:</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(emailExtrasTotal)}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 5px 0; color: #555;">Delivery &amp; Setup:</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(deliveryFee)}</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="padding: 5px 0; color: #555;">Subtotal:</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(emailSubtotal)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #555;">Processing Fee (${pct(processingRate)}):</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(emailProcessingFee)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #555;">Sales Tax (${pct(taxRate)}):</td>
            <td style="padding: 5px 0; text-align: right;">$${formatPrice(emailSalesTax)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #777; font-size: 13px;">Cash Price (no card fee):</td>
            <td style="padding: 5px 0; text-align: right; color: #777; font-size: 13px;">$${formatPrice(emailCashPrice)}</td>
          </tr>
          <tr style="border-top: 2px solid #2b6cb0;">
            <td style="padding: 8px 0; font-weight: bold; font-size: 16px;">Total:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 16px; color: #ea580c;">$${formatPrice(emailTotal)}</td>
          </tr>
        </table>
      </div>`;
  // ─────────────────────────────────────────────────────────────────────

  // The one block that differs, and it has three states. A customer who has
  // already paid must not be told an invoice is coming or that no deposit is
  // required — and one whose payment PayPal has not finished clearing must not
  // be told it is done, which is the thing they would act on.
  const paymentInfoHtml = !payment.paid
    ? `
          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">💳 Payment Information</h3>
            <p style="margin: 0; color: #92400e; font-weight: 500;">
              We will contact you the day before your event to confirm your booking details. Once confirmed, we will send you an invoice that can be paid online. Cash on delivery is also accepted. No deposit is required. All sales are final — no refunds.
            </p>
          </div>`
    : !payment.settled
      ? `
          <div style="background-color: #eff6ff; border: 1px solid #93c5fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1e40af;">💳 Payment Received — Clearing</h3>
            <p style="margin: 0; color: #1e40af; font-weight: 500;">
              PayPal has your payment of $${formatPrice(payment.capturedAmount ?? emailTotal)} and is still clearing it, which can take a few business days. There is nothing for you to do — we will email you the moment it confirms, and we will contact you the day before your event either way. All sales are final — no refunds.
            </p>
          </div>`
      : `
          <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #166534;">✅ Paid in Full</h3>
            <p style="margin: 0; color: #166534; font-weight: 500;">
              We received your payment of $${formatPrice(emailTotal)} via PayPal. No invoice will follow and nothing is due on delivery. We will contact you the day before your event to confirm the details. All sales are final — no refunds.
            </p>
          </div>`;

  try {
    // Inside the try: the Resend constructor throws when RESEND_API_KEY is
    // unset, and the rental is already persisted — an escape here tells the
    // customer their booking failed when it did not.
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send confirmation email to customer
    await withTimeout(
      resend.emails.send({
        from: "SATX Ritas Rentals <bookings@satxritas.com>",
        to: [rental.customer.email],
        bcc: ["satxbounce@gmail.com"], // BCC the business email
        subject: "SATX Ritas Margarita Rentals - Booking Confirmation",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
          <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">Booking Confirmed!</h1>
          <p style="font-size: 16px;">Dear ${escapeHtml(rental.customer.name)},</p>
          <p style="font-size: 16px;">Thank you for booking with SATX Ritas! Your rental for a ${rental.machineType} machine has been confirmed.</p>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0;"><strong style="color: #2b6cb0;">Booking ID:</strong> ${bookingId}</p>
          </div>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Rental Details:</strong></p>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px;">🗓 Rental Date: ${rental.rentalDate} at ${rental.rentalTime}</li>
              <li style="margin-bottom: 8px;">🗓 Return Date: ${rental.returnDate} at ${rental.returnTime}</li>
              <li style="margin-bottom: 8px;">🍹 Selected Mixers: ${
                selectedMixers.length > 0
                  ? selectedMixers
                      .map((m) => escapeHtml(mixerLabel(m)))
                      .join(", ")
                  : "None — Bring your own mixer"
              }</li>
              ${
                rental.selectedExtras && rental.selectedExtras.length > 0
                  ? `<li style="margin-bottom: 8px;">🎉 Party Extras: ${rental.selectedExtras
                      .map(
                        (extra: { name: string; quantity?: number }) =>
                          // Names come from buildExtrasCatalog, which composes
                          // mixer entries from admin-controlled
                          // Settings.mixers[*].label — so this is not a
                          // server-derived constant and reaches the customer's
                          // inbox as raw HTML if left unescaped.
                          `${escapeHtml(extra.name)}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
                      )
                      .join(", ")}</li>`
                  : ""
              }
              <li style="margin-bottom: 8px;">⚡ Machine Capacity: ${rental.capacity}L</li>
            </ul>
          </div>

          ${pricingBreakdownHtml}

          ${mixerGuideHtml}

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Delivery Address:</strong></p>
            <p style="margin: 0;">
              ${escapeHtml(rental.customer.address.street)}<br>
              ${escapeHtml(rental.customer.address.city)}, ${escapeHtml(rental.customer.address.state)} ${escapeHtml(rental.customer.address.zipCode)}
            </p>
          </div>

          <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Contact Information:</strong></p>
            <ul style="list-style-type: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px;">📱 Phone: ${escapeHtml(rental.customer.phone)}</li>
              <li style="margin-bottom: 8px;">📧 Email: ${escapeHtml(rental.customer.email)}</li>
            </ul>
          </div>

          ${paymentInfoHtml}

          <p style="font-size: 16px; background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
            If you have any questions or need to make changes to your booking, please don't hesitate to contact us.
            Please reference your Booking ID <strong>${bookingId}</strong> in any communications.
          </p>

          <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
            Best regards,<br>
            SATX Ritas Margarita Rentals Team
          </p>
          </div>
        `,
      }),
      NOTIFICATION_TIMEOUT_MS,
      "Resend",
    );
  } catch (emailError) {
    console.error(
      "Error sending confirmation email:",
      safeErrorSummary(emailError),
    );
    // Continue with the booking process even if email fails
  }

  // Collect the Twilio send that was started before the email. It ran
  // concurrently with it, so this usually resolves immediately; a failure
  // is logged and never changes the response, exactly as before.
  if (smsInFlight) {
    try {
      await smsInFlight;
    } catch (smsError) {
      console.error("Error sending SMS:", safeErrorSummary(smsError));
    }
  }
}
