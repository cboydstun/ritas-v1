import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { isMachineAvailable, releaseStaleHolds } from "@/lib/inventory";
import { safeErrorSummary } from "@/lib/safe-error";
import twilio from "twilio";
import { Resend } from "resend";
import { nanoid } from "nanoid";
import { mixerDetails } from "@/lib/rental-data";
import { formatPrice } from "@/lib/pricing";
import {
  computeOrderTotal,
  validateDeliveryTime,
  isBexarCountyZipCode,
  type SettingsOverrides,
} from "@/components/order/utils";
import type { OrderFormData } from "@/components/order/types";
import {
  resolveSelectedExtras,
  resolveSelectedMixers,
} from "@/lib/extras-catalog";
import { guardPublicWrite } from "@/lib/api-guard";
import { withTimeout, NOTIFICATION_TIMEOUT_MS } from "@/lib/with-timeout";
import {
  MACHINE_CAPACITY,
  escapeHtml,
  firstIssueMessage,
  rentalDataSchema,
} from "@/lib/validation";

/** Render a rate like 0.0825 as "8.25%" so labels track the real settings. */
const pct = (rate: number): string => `${Number((rate * 100).toFixed(4))}%`;

/**
 * "14:00" → "2:00 PM". The delivery-window picker defaults to the "ANY"
 * sentinel, which the old formatter fed to parseInt and rendered as the
 * nonsense "12:undefined AM" in every operator SMS.
 */
function formatDeliveryTime(time: string): string {
  if (!time || time === "ANY") return "Any Time";

  const [hourPart, minutePart] = time.split(":");
  const hour24 = parseInt(hourPart, 10);
  if (!Number.isFinite(hour24) || !minutePart) return "Any Time";

  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutePart} ${hour24 >= 12 ? "PM" : "AM"}`;
}

export async function POST(request: Request) {
  try {
    // Every booking persists a rental and fans out to Twilio and Resend, so
    // an unthrottled caller costs money and holds inventory hostage.
    const guard = await guardPublicWrite(request, {
      route: "save-booking",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    const body = guard.data as { rentalData?: unknown } | null;

    const parsed = rentalDataSchema.safeParse(body?.rentalData);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }
    const rentalData = parsed.data;

    // Capacity is derived, never taken from the request: a mismatched
    // machineType/capacity pair used to match zero existing rentals and so
    // sailed past the availability check entirely.
    const capacity = MACHINE_CAPACITY[rentalData.machineType];

    // Generate a unique booking ID
    const bookingId = nanoid(10).toUpperCase();

    // Connect to MongoDB
    await dbConnect();

    // Abandoned checkouts hold units indefinitely otherwise. The cron job is
    // the primary sweeper; this call keeps the booking path correct even if
    // the schedule is not configured.
    await releaseStaleHolds();

    // Inventory pre-check — refuse to persist the booking if all units of
    // this machine type are already booked for any day in the requested range.
    const availability = await isMachineAvailable(
      rentalData.machineType,
      capacity,
      rentalData.rentalDate,
      rentalData.returnDate,
    );
    if (!availability.available) {
      return NextResponse.json(
        {
          message:
            availability.reason ??
            "This machine is no longer available for the selected dates. Please pick a different date or machine.",
        },
        { status: 409 },
      );
    }

    // Fetch admin settings so the booking total reflects any pricing overrides
    const settingsDoc = (await Settings.findOne({ key: "global" }).lean()) as {
      fees?: {
        deliveryFee?: number;
        salesTaxRate?: number;
        processingFeeRate?: number;
        serviceDiscountRate?: number;
      };
      machines?: {
        single?: { basePrice: number };
        double?: { basePrice: number };
        triple?: { basePrice: number };
      };
      mixers?: Record<
        string,
        { price: number; label?: string; description?: string }
      >;
      extras?: Record<string, { price: number }>;
      operations?: {
        deliveryWindowStartHour?: number;
        deliveryWindowEndHour?: number;
      };
    } | null;

    // The delivery window and the Bexar-County service area were enforced only
    // in the browser (OrderForm/DetailsStep), so a direct POST could book a
    // 03:00 delivery to any ZIP in the country. Money was never at risk —
    // pricing is fully server-derived — but the operational rules were not
    // enforced anywhere the customer could not reach.
    const startHour = settingsDoc?.operations?.deliveryWindowStartHour ?? 8;
    const endHour = settingsDoc?.operations?.deliveryWindowEndHour ?? 18;
    for (const [label, time] of [
      ["Delivery", rentalData.rentalTime],
      ["Pickup", rentalData.returnTime],
    ] as const) {
      if (!validateDeliveryTime(time, startHour, endHour)) {
        return NextResponse.json(
          {
            message: `${label} time must be between ${startHour}:00 and ${endHour}:00`,
          },
          { status: 400 },
        );
      }
    }

    if (!isBexarCountyZipCode(rentalData.customer.address.zipCode)) {
      return NextResponse.json(
        {
          message:
            "We currently deliver only within Bexar County. Please call us to arrange delivery outside the area.",
        },
        { status: 400 },
      );
    }

    // ── Authoritative server-side total ──────────────────────────────────
    // Reuses computeOrderTotal — the same function PricingSummary renders
    // for the customer — so the email, SMS, and DB payment.amount all match
    // exactly what was shown on the order page (including flat-priced extras,
    // admin extras-price overrides, and the service discount).
    const overrides: SettingsOverrides = {
      fees: settingsDoc?.fees,
      machines: settingsDoc?.machines,
      mixers: settingsDoc?.mixers,
      extras: settingsDoc?.extras,
    };

    // Add-ons are re-resolved against the server catalog, so name, price and
    // pricingType come from our data rather than the request body.
    const { extras: selectedExtras, unknownIds } = resolveSelectedExtras(
      rentalData.selectedExtras,
      { extras: settingsDoc?.extras, mixers: settingsDoc?.mixers },
    );
    if (unknownIds.length > 0) {
      return NextResponse.json(
        { message: "One or more selected extras are not available" },
        { status: 400 },
      );
    }

    // Tank mixers are re-resolved the same way. The set of valid flavours is
    // whatever `Settings.mixers` holds, so a flavour an admin adds is a real,
    // bookable choice rather than a card that 400s at checkout.
    const { mixers: resolvedMixers, unknownIds: unknownMixerIds } =
      resolveSelectedMixers(rentalData.selectedMixers, {
        extras: settingsDoc?.extras,
        mixers: settingsDoc?.mixers,
      });
    if (unknownMixerIds.length > 0) {
      return NextResponse.json(
        { message: "One or more selected mixers are not available" },
        { status: 400 },
      );
    }

    /** Display label for a mixer id, including admin-added flavours. */
    const mixerLabel = (id: string): string =>
      settingsDoc?.mixers?.[id]?.label ??
      mixerDetails[id as keyof typeof mixerDetails]?.label ??
      id;

    const totals = computeOrderTotal(
      {
        machineType: rentalData.machineType,
        selectedMixers: resolvedMixers,
        selectedExtras,
        rentalDate: rentalData.rentalDate,
        returnDate: rentalData.returnDate,
        // The service discount was retired from the product. It is applied by
        // hand at invoicing time for legacy cases and is never client-settable.
        isServiceDiscount: false,
      } as OrderFormData,
      overrides,
    );

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

    const taxRate = settingsDoc?.fees?.salesTaxRate ?? 0.0825;
    const processingRate = settingsDoc?.fees?.processingFeeRate ?? 0.03;
    // ─────────────────────────────────────────────────────────────────────

    // Built field by field rather than spreading the request body: `price`
    // used to be whatever the browser computed, which could disagree with the
    // server-side `payment.amount` sitting right beside it.
    const rental = new Rental({
      machineType: rentalData.machineType,
      capacity,
      selectedMixers: resolvedMixers,
      selectedExtras,
      price: emailTotal,
      rentalDate: rentalData.rentalDate,
      rentalTime: rentalData.rentalTime,
      returnDate: rentalData.returnDate,
      returnTime: rentalData.returnTime,
      customer: {
        name: rentalData.customer.name,
        email: rentalData.customer.email,
        phone: rentalData.customer.phone,
        address: {
          street: rentalData.customer.address.street,
          city: rentalData.customer.address.city,
          state: rentalData.customer.address.state,
          zipCode: rentalData.customer.address.zipCode,
        },
      },
      notes: rentalData.notes,
      isServiceDiscount: false,
      bookingId,
      status: "pending_payment", // Different from "pending" - indicates we're waiting for manual payment
      payment: {
        paypalTransactionId: null, // No PayPal transaction
        amount: emailTotal,
        status: "pending",
        date: new Date(),
      },
    });

    const savedRental = await rental.save();

    // The check above and this write are not atomic, so two concurrent
    // requests could both claim the last unit. Re-count now that our own hold
    // is persisted (excluding it), and roll back if we oversold.
    //
    // `ignoreCreatedFrom` makes that recheck asymmetric: only holds that
    // already existed when ours landed can displace us. A symmetric recheck
    // had both racers roll themselves back, rejecting two real customers and
    // leaving the unit unsold.
    const recheck = await isMachineAvailable(
      rentalData.machineType,
      capacity,
      rentalData.rentalDate,
      rentalData.returnDate,
      {
        excludeRentalId: savedRental._id.toString(),
        ignoreCreatedFrom: savedRental.createdAt ?? new Date(),
        // `createdAt` is millisecond-resolution, so two requests built in the
        // same tick each fell outside the other's cutoff and both survived.
        tieBreakId: savedRental._id.toString(),
      },
    );
    if (!recheck.available) {
      // The compensating delete is the only thing standing between a losing
      // racer and an oversold unit. If it throws, the outer catch returns a
      // generic 500 and the rental stays in the collection holding inventory,
      // indistinguishable in the logs from any other failure — so it gets its
      // own marker an operator can alert on.
      try {
        await Rental.deleteOne({ _id: savedRental._id });
      } catch (rollbackError) {
        console.error("OVERSELL_ROLLBACK_FAILED", {
          rentalId: savedRental._id.toString(),
          bookingId: savedRental.bookingId,
          reason:
            rollbackError instanceof Error
              ? rollbackError.name
              : "UnknownError",
        });
        throw rollbackError;
      }
      return NextResponse.json(
        {
          message:
            recheck.reason ??
            "This machine was just booked for the selected dates. Please pick a different date or machine.",
        },
        { status: 409 },
      );
    }

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

        // Started, not awaited. Both notifications are fire-and-log — the
        // booking is already committed and stands either way — but awaiting
        // them one after the other made the customer wait up to two full
        // NOTIFICATION_TIMEOUT_MS windows after their booking had succeeded.
        // The result is collected alongside the email below.
        smsInFlight = withTimeout(
          twilioClient.messages.create({
            body:
              `🎉 NEW BOOKING - PAYMENT PENDING\n` +
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
              `⚠️ INVOICE CUSTOMER FOR PAYMENT`,
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
      const mixerKey = selectedMixers[i] as
        keyof typeof mixerDetails | undefined;
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

          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #92400e;">💳 Payment Information</h3>
            <p style="margin: 0; color: #92400e; font-weight: 500;">
              We will contact you the day before your event to confirm your booking details. Once confirmed, we will send you an invoice that can be paid online. Cash on delivery is also accepted. No deposit is required. All sales are final — no refunds.
            </p>
          </div>

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

    return NextResponse.json({
      success: true,
      bookingId,
      rentalId: savedRental._id.toString(),
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    // Only the error's shape is logged. Mongoose validation and duplicate-key
    // messages embed the offending values — name, email, phone, address — and
    // production builds keep console.error, so logging them wholesale shipped
    // customer PII into the runtime logs.
    console.error("Error saving booking:", safeErrorSummary(error));

    // Detail stays in the logs — Mongoose validation and MongoServerError
    // messages expose collection names, field paths and index names.
    return NextResponse.json(
      { message: "Failed to save booking" },
      { status: 500 },
    );
  }
}
