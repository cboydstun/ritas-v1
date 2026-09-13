import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { StepProps } from "../types";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import { formatPrice } from "@/lib/pricing";
import {
  computeOrderTotal,
  buildSuccessUrl,
  buildAnalyticsItems,
} from "../utils";
import { buildExtrasCatalog } from "@/lib/extras-catalog";
import { trackEvent, pushDataLayerThen } from "@/lib/analytics";
import { hashUserData } from "@/lib/enhanced-conversions";

// Kept out of the /order entry bundle: the PayPal SDK is large and only
// matters once a visitor reaches the last step.
const PayPalCheckout = dynamic(() => import("../PayPalCheckout"), {
  ssr: false,
});

/**
 * The `message` from an error response, or a fallback.
 *
 * A 502/504 answers with an HTML error page, and `response.json()` then threw
 * a SyntaxError that was rendered to the customer verbatim as
 * `Unexpected token '<' ... is not valid JSON`.
 */
async function errorMessageFrom(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.message === "string" ? body.message : fallback;
  } catch {
    return fallback;
  }
}

export default function ReviewStep({
  formData,
  agreedToTerms = false,
  setAgreedToTerms = () => {},
  onSuccess,
  settings,
}: StepProps) {
  // Read here rather than at module scope so the value is observable in a
  // test without re-importing the module — which loads a second copy of React
  // and breaks every hook. Next still inlines the literal at build time.
  const paypalEnabled = Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLatch = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Three latches, not one, because the PayPal flow spans two callbacks with
  // the buyer's attention in a popup in between:
  //
  //  - `submitLatch` guards the invoice path, as it always has. It is set and
  //    released inside one handler.
  //  - `paypalFlowActive` is set when the popup opens and cleared only on
  //    cancel or error — never on approve, which runs later and would be
  //    blocked by a latch the same handler had taken.
  //  - `captureLatch` guards the capture itself, which a double tap can fire
  //    twice.
  const paypalFlowActive = useRef(false);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const captureLatch = useRef(false);

  // Two halves of the same defence, and they are deliberately separate.
  //
  // `heldOrderId` is the PayPal order currently open; cancelling releases it.
  // `heldBookingId` outlives that release and is sent as `reuseBookingId` on
  // the next attempt — so if the release did not land (offline, a dropped
  // keepalive, a crash) the buyer reprices the hold they already own instead
  // of taking a second unit. With two triples in stock, two abandons would
  // otherwise lock them out of their own date.
  //
  // Clearing both on cancel would make the reuse path dead code on the one
  // path it exists for.
  const heldBookingId = useRef<string | null>(null);
  const heldOrderId = useRef<string | null>(null);

  const {
    basePrice,
    mixerPrice,
    deliveryFee,
    deliveryBaseFee,
    distanceSurcharge,
    perDayRate,
    rentalDays,
    extrasTotal,
    salesTax,
    processingFee,
    cashPrice,
    finalTotal,
  } = computeOrderTotal(formData, settings);

  const taxRate = settings?.fees?.salesTaxRate ?? 0.0825;
  const processingRate = settings?.fees?.processingFeeRate ?? 0.03;
  const pct = (rate: number) => `${Number((rate * 100).toFixed(4))}%`;

  // Extras catalog prices, so line items agree with the computed total.
  const extrasCatalog = buildExtrasCatalog({
    extras: settings?.extras,
    mixers: settings?.mixers,
  });

  /**
   * Everything that happens once a booking exists, shared by both paths.
   *
   * Extracted so the PayPal and invoice flows cannot drift on what they
   * report: they are one purchase either way, distinguished only by `method`
   * — a GA4 custom dimension that is already registered on the property.
   */
  const finishBooking = async (
    bookingId: string,
    method: "paypal" | "invoice",
  ) => {
    // The only place a booking's id and total exist together on the client,
    // so it is the only place `purchase` can be emitted. gtag sends via
    // sendBeacon, so the hit survives the navigation below.
    trackEvent("purchase", {
      transaction_id: bookingId,
      value: finalTotal,
      currency: "USD",
      tax: salesTax + processingFee,
      shipping: deliveryFee,
      machine_type: formData.machineType,
      method,
      items: buildAnalyticsItems(
        formData,
        { perDayRate, rentalDays },
        extrasCatalog,
      ),
    });

    // Clear the saved draft before redirecting so a future visit starts fresh
    onSuccess?.();

    // The Google Ads conversion fires off this push, not off a `/success`
    // pageview. The pageview trigger could not see the order total — the
    // success URL carries only what `buildSuccessUrl` deems safe — so every
    // booking reported to Ads as a valueless conversion, which no
    // value-based bid strategy can use. `transaction_id` doubles as the Ads
    // `orderId`, which is what dedupes a resubmitted conversion.
    //
    // The redirect happens from the callback, not after the push: the Ads
    // tag is a request the container issues itself, and navigating in the
    // same tick could cut it off before it left the browser. See
    // `pushDataLayerThen` — it also guarantees the redirect still happens
    // when no tag ever answers.
    // Enhanced conversions. Hashed in the browser before it reaches the
    // dataLayer, so no raw contact detail is ever readable by a container
    // tag or a GTM preview session. Returns undefined on a consent denial or
    // an insecure origin, and the key is then omitted rather than sent empty.
    const userData = await hashUserData(formData.customer);

    pushDataLayerThen(
      "purchase_complete",
      {
        transaction_id: bookingId,
        value: finalTotal,
        currency: "USD",
        ...(userData ? { user_data: userData } : {}),
      },
      () => {
        // Redirect to success page (no alert). buildSuccessUrl owns which
        // params are safe to put in a URL GA4 will record — see its docs.
        //
        // A full-page navigation from an async handler, not render-phase
        // state: it deliberately leaves React's world behind, the draft has
        // just been cleared and /success is a separate route.
        window.location.href = buildSuccessUrl(
          bookingId,
          formData.machineType,
          formData.selectedMixers,
          { paid: method === "paypal" },
        );
      },
    );
  };

  /** The cart, in the shape both server routes accept. */
  const rentalDataPayload = () => ({
    machineType: formData.machineType,
    selectedMixers: formData.selectedMixers,
    selectedExtras: formData.selectedExtras.map((extra) => ({
      id: extra.id,
      quantity: extra.quantity ?? 1,
    })),
    rentalDate: formData.rentalDate,
    rentalTime: formData.rentalTime,
    returnDate: formData.returnDate,
    returnTime: formData.returnTime,
    customer: formData.customer,
    notes: formData.notes,
  });

  /**
   * Hand the machine back when the buyer closes the PayPal window.
   *
   * Best-effort and never awaited for its result: the stale-hold reaper is
   * the real guarantee. What this buys is the buyer who cancels and then
   * books through the invoice button — without it, on the last unit, they are
   * refused by their own abandoned hold.
   */
  const releaseHold = useCallback(async () => {
    const orderId = heldOrderId.current;
    heldOrderId.current = null;
    if (!orderId) return;

    try {
      await fetch("/api/v1/paypal/release-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        keepalive: true,
      });
    } catch {
      // The reaper will get it, and `heldBookingId` still points at the hold
      // so the next attempt reprices it rather than taking another unit.
    }
  }, []);

  const handleCreatePayPalOrder = async (): Promise<string> => {
    // The `disabled` prop is advisory — the SDK will still open a session on
    // a programmatic click — and this checkbox is the only consent artefact
    // the booking has.
    if (!agreedToTerms) {
      setSubmitError("Please agree to the terms and conditions");
      throw new Error("Terms not accepted");
    }

    paypalFlowActive.current = true;
    setPaypalBusy(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/v1/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalData: rentalDataPayload(),
          // Reprices the hold this browser already owns rather than taking a
          // second unit for the same cart. Harmless when the hold was
          // successfully released — the server finds nothing and inserts.
          ...(heldBookingId.current
            ? { reuseBookingId: heldBookingId.current }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(
            response,
            "We could not start the payment. Please try again, or book now and we will invoice you.",
          ),
        );
      }

      const result = await response.json();
      if (!result?.id || !result?.bookingId) {
        throw new Error("PayPal did not return an order. Please try again.");
      }

      heldBookingId.current = result.bookingId;
      heldOrderId.current = result.id;
      return result.id;
    } catch (error) {
      // Clearing the flag here rather than relying on the SDK to route this
      // throw to `onError`: if it does not, the invoice button stays disabled
      // and the customer has no way to book at all. `onError` clearing it a
      // second time is harmless.
      paypalFlowActive.current = false;
      setPaypalBusy(false);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not start the payment. Please try again.",
      );
      throw error;
    }
  };

  const handleApprovePayPalOrder = async (orderId: string) => {
    if (captureLatch.current) return;
    captureLatch.current = true;

    try {
      const response = await fetch("/api/v1/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(
            response,
            "We could not confirm your payment. Please call us before trying again.",
          ),
        );
      }

      const result = await response.json();
      if (!result?.bookingId) {
        throw new Error(
          "We could not confirm your booking reference. Please call us and we will take it over the phone.",
        );
      }

      // Paid and confirmed — the hold is now a booking, so there is nothing
      // left to release and nothing left to reuse.
      heldOrderId.current = null;
      heldBookingId.current = null;
      await finishBooking(result.bookingId, "paypal");
    } catch (error) {
      // The money may well have moved, so this deliberately does not release
      // the hold or invite a second attempt.
      console.error("PayPal capture error:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "We could not confirm your payment. Please call us before trying again.",
      );
      captureLatch.current = false;
      paypalFlowActive.current = false;
      setPaypalBusy(false);
    }
  };

  const handleCancelPayPal = () => {
    paypalFlowActive.current = false;
    setPaypalBusy(false);
    void releaseHold();
  };

  const handlePayPalError = (error: Error) => {
    console.error("PayPal error:", error);
    paypalFlowActive.current = false;
    setPaypalBusy(false);
    // "Terms not accepted" already has its own message on screen.
    if (error.message !== "Terms not accepted") {
      setSubmitError(
        "Something went wrong with PayPal. You can book now and we will invoice you instead.",
      );
    }
    void releaseHold();
  };

  const handleConfirmBooking = async () => {
    if (!agreedToTerms) {
      setSubmitError("Please agree to the terms and conditions");
      return;
    }

    // A ref, not the `isSubmitting` state: the button's disabled attribute
    // only takes effect on the next render, so two clicks dispatched in the
    // same tick both reached the fetch and booked the machine twice.
    if (submitLatch.current || paypalFlowActive.current) return;
    submitLatch.current = true;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Give back any PayPal hold first. Otherwise this booking competes with
      // the abandoned one for the same unit and, on the last one, loses to it.
      await releaseHold();

      const response = await fetch("/api/save-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // `price` and `isServiceDiscount` are deliberately not sent: the
        // server computes the total itself and strips both anyway. Extras
        // are sent as id + quantity only, for the same reason.
        body: JSON.stringify({ rentalData: rentalDataPayload() }),
      });

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(
            response,
            "We could not save your booking. Please try again, or call us and we will take it over the phone.",
          ),
        );
      }

      const result = await response.json();

      // A 200 with no booking id is not a booking. Redirecting anyway sent the
      // customer to `/success?bookingId=undefined` with nothing to reference.
      if (!result?.bookingId) {
        throw new Error(
          "We could not confirm your booking reference. Please call us and we will take it over the phone.",
        );
      }

      await finishBooking(result.bookingId, "invoice");
    } catch (error) {
      console.error("Booking submission error:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to confirm booking",
      );
      setIsSubmitting(false);
      // Release the latch so a failed attempt can be retried.
      submitLatch.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
        Review & Confirm Your Order
      </h2>

      {/* Trust Signals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-green-200 dark:border-green-700">
          <div className="flex items-center space-x-3">
            <div className="shrink-0">
              <svg
                className="w-8 h-8 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              {/* Previously promised "guaranteed or refund", directly
                  contradicting the no-refunds terms further down this page
                  and in the FAQ. */}
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                Fully Serviced
              </p>
              {/* "included" beside an itemised Delivery Fee is the worst
                  place in the app to say it. We do handle all three; the
                  delivery charge is a line above this one. */}
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                We handle delivery, setup &amp; cleanup
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center space-x-3">
            <div className="shrink-0">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                Secure Booking
              </p>
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                Your data is safe
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
          <div className="flex items-center space-x-3">
            <div className="shrink-0">
              <svg
                className="w-8 h-8 text-orange-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-white">
                On-Time Delivery
              </p>
              <p className="text-xs text-charcoal/70 dark:text-white/70">
                Always punctual
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <div className="relative w-full aspect-square mb-4">
            <Image
              src={
                formData.machineType === "single"
                  ? "/vevor-15l-slushy-2.jpg"
                  : formData.machineType === "double"
                    ? "/vevor-30l-slushy-2.png"
                    : "/vevor-45l-slushy-1.webp"
              }
              alt={`${formData.capacity}L ${
                formData.machineType === "single"
                  ? "Single"
                  : formData.machineType === "double"
                    ? "Double"
                    : "Triple"
              } Tank Machine`}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover rounded-lg"
            />
          </div>
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Selected Machine
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.capacity}L{" "}
            {formData.machineType === "single"
              ? "Single"
              : formData.machineType === "double"
                ? "Double"
                : "Triple"}{" "}
            Tank Machine
          </p>
          <div className="text-charcoal/70 dark:text-white/70">
            <p className="mb-2">Selected Mixers:</p>
            {formData.selectedMixers.length === 0 ? (
              <p>No mixers selected - Bring your own mixer</p>
            ) : formData.machineType === "single" ? (
              // Single Tank Display
              <ul className="list-disc list-inside">
                {formData.selectedMixers[0] && (
                  <li>
                    {mixerDetails[formData.selectedMixers[0] as MixerType]
                      ?.label ?? formData.selectedMixers[0]}
                  </li>
                )}
              </ul>
            ) : formData.machineType === "double" ? (
              // Double Tank Display
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Tank 1:</p>
                  {formData.selectedMixers[0] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[0] as MixerType]
                        ?.label ?? formData.selectedMixers[0]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 2:</p>
                  {formData.selectedMixers[1] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[1] as MixerType]
                        ?.label ?? formData.selectedMixers[1]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
              </div>
            ) : (
              // Triple Tank Display
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Tank 1:</p>
                  {formData.selectedMixers[0] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[0] as MixerType]
                        ?.label ?? formData.selectedMixers[0]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 2:</p>
                  {formData.selectedMixers[1] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[1] as MixerType]
                        ?.label ?? formData.selectedMixers[1]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
                <div>
                  <p className="font-medium">Tank 3:</p>
                  {formData.selectedMixers[2] ? (
                    <p className="ml-4">
                      {mixerDetails[formData.selectedMixers[2] as MixerType]
                        ?.label ?? formData.selectedMixers[2]}
                    </p>
                  ) : (
                    <p className="ml-4">No mixer - Bring your own</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* TABC / BYOB reminder */}
          <p className="text-xs text-charcoal/70 dark:text-white/60 italic mt-2">
            🚫 Alcohol not included — Texas TABC prohibits us from providing it.
            Add your own (max 1.75L per tank) if desired. Please drink
            responsibly.
          </p>

          <p className="text-xl font-bold text-orange mt-2">
            ${formatPrice(perDayRate)}/day
          </p>
        </div>

        {formData.selectedExtras.length > 0 && (
          <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl mt-4">
            <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
              Selected Extras
            </h3>
            <div className="space-y-2">
              {formData.selectedExtras.map((extra) => {
                // Mirror computeOrderTotal exactly: catalog price, and flat
                // items are charged once rather than per day. Rendering
                // everything as "/day × N" made the line items disagree with
                // the total for every flat-priced add-on.
                const catalogItem = extrasCatalog.get(extra.id);
                if (!catalogItem) return null;

                const quantity = catalogItem.allowQuantity
                  ? extra.quantity || 1
                  : 1;
                const isFlat = catalogItem.pricingType === "flat";
                const unitTotal = catalogItem.price * quantity;
                const lineTotal = isFlat ? unitTotal : unitTotal * rentalDays;

                return (
                  <div key={extra.id} className="flex justify-between">
                    <p className="text-charcoal/70 dark:text-white/70">
                      {catalogItem.name} {quantity > 1 ? `(${quantity}x)` : ""}
                    </p>
                    <p className="text-charcoal/70 dark:text-white/70">
                      {isFlat || rentalDays === 1
                        ? `$${formatPrice(lineTotal)}`
                        : `$${formatPrice(unitTotal)}/day × ${rentalDays} days = $${formatPrice(lineTotal)}`}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-lg font-semibold text-orange mt-4">
              Extras Total: ${formatPrice(extrasTotal)}
            </p>
          </div>
        )}

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Rental Details
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            Delivery:{" "}
            {new Date(formData.rentalDate + "T12:00:00").toLocaleDateString()}{" "}
            at {formData.rentalTime}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Pick Up:{" "}
            {new Date(formData.returnDate + "T12:00:00").toLocaleDateString()}{" "}
            at {formData.returnTime}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Contact Information
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.name}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.email}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.phone}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            {formData.customer.address.street},
            <br />
            {formData.customer.address.city}, {formData.customer.address.state}{" "}
            {formData.customer.address.zipCode}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl">
          <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
            Pricing Details
          </h3>
          <p className="text-charcoal/70 dark:text-white/70">
            Machine: ${formatPrice(basePrice)}/day
          </p>
          {formData.selectedMixers.length > 0 && (
            <p className="text-charcoal/70 dark:text-white/70">
              {formData.selectedMixers.length} Mixer
              {formData.selectedMixers.length > 1 ? "s" : ""}: $
              {formatPrice(mixerPrice)}/day
            </p>
          )}
          <p className="text-charcoal/70 dark:text-white/70">
            Rate: ${formatPrice(perDayRate)}/day × {rentalDays} day
            {rentalDays > 1 ? "s" : ""} = $
            {formatPrice(perDayRate * rentalDays)}
          </p>
          {formData.selectedExtras.length > 0 && (
            // Just the catalog-derived total. This line used to re-derive a
            // "/day × N" figure from the raw selectedExtras `price` fields,
            // which ignored admin overrides, charged flat items per day, and
            // therefore disagreed with the Selected Extras block above.
            <p className="text-charcoal/70 dark:text-white/70">
              Extras: ${formatPrice(extrasTotal)}
            </p>
          )}
          <p className="text-charcoal/70 dark:text-white/70">
            Delivery Fee: ${formatPrice(deliveryFee)}
          </p>
          {/* The split, named. `deliveryFee` is the total charged; showing only
              it leaves a customer in a $0-surcharge ZIP unable to tell why they
              are billed anything, and one in a $100 ZIP unable to tell why they
              are billed more than the surcharge they were quoted. */}
          {distanceSurcharge > 0 && (
            <p className="pl-4 text-xs text-charcoal/70 dark:text-white/60">
              ${formatPrice(deliveryBaseFee)} delivery &amp; setup + $
              {formatPrice(distanceSurcharge)} distance surcharge
            </p>
          )}
          <p className="text-charcoal/70 dark:text-white/70">
            Subtotal: $
            {formatPrice(perDayRate * rentalDays + deliveryFee + extrasTotal)}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Processing Fee ({pct(processingRate)}): $
            {formatPrice(processingFee)}
          </p>
          <p className="text-charcoal/70 dark:text-white/70">
            Sales Tax ({pct(taxRate)}): ${formatPrice(salesTax)}
          </p>
          <p className="text-charcoal/70 dark:text-white/60 text-sm">
            Cash Price (no card fee): ${formatPrice(cashPrice)}
          </p>
          <p className="text-xl font-bold text-orange mb-4">
            Total Amount: ${formatPrice(finalTotal)}
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mt-4">
            <div className="flex items-center space-x-3">
              <div className="shrink-0">
                <svg
                  className="h-5 w-5 text-blue-600 dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Payment Information
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  {paypalEnabled
                    ? "Pay the full amount now with PayPal, a card or Pay Later, or book now and we will invoice you before your event. Cash on delivery is also accepted. All sales are final — no refunds."
                    : "We will contact you the day before your event to confirm your booking details. Once confirmed, we will send you an invoice that can be paid online. Cash on delivery is also accepted. No deposit is required. All sales are final — no refunds."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 mt-4">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 text-orange rounded-sm focus:ring-orange"
            />
            <label
              htmlFor="agreeTerms"
              className="text-charcoal/70 dark:text-white/70"
            >
              I confirm all the information above is correct and agree to
              communications.
            </label>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div
              role="alert"
              className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg"
            >
              <p className="text-sm text-red-700 dark:text-red-300">
                {submitError}
              </p>
            </div>
          )}

          {/* Pay now — the primary path when PayPal is configured. */}
          {paypalEnabled && (
            <div className="mt-6">
              <PayPalCheckout
                amountUsd={finalTotal}
                disabled={!agreedToTerms || isSubmitting}
                createOrder={handleCreatePayPalOrder}
                onApprove={handleApprovePayPalOrder}
                onCancel={handleCancelPayPal}
                onError={handlePayPalError}
              />
              <div className="flex items-center gap-3 mt-6" aria-hidden="true">
                <span className="h-px flex-1 bg-charcoal/15 dark:bg-white/15" />
                <span className="text-xs uppercase tracking-wide text-charcoal/70 dark:text-white/60">
                  or
                </span>
                <span className="h-px flex-1 bg-charcoal/15 dark:bg-white/15" />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6">
            <button
              onClick={handleConfirmBooking}
              disabled={!agreedToTerms || isSubmitting || paypalBusy}
              className={
                paypalEnabled
                  ? "w-full border-2 border-charcoal/20 dark:border-white/25 text-charcoal dark:text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 hover:border-charcoal/40 dark:hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  : "w-full bg-linear-to-r from-orange to-pink hover:from-orange/90 hover:to-pink/90 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              }
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Confirming Booking...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    {paypalEnabled
                      ? "Book now, invoice me later"
                      : "Confirm Booking"}
                  </span>
                </span>
              )}
            </button>

            <p className="mt-3 text-xs text-charcoal/70 dark:text-white/60 text-center">
              {paypalEnabled
                ? "🔒 Paying is optional. Book now and we will contact you the day before your event, then send an invoice. Cash on delivery also accepted. All sales are final."
                : "🔒 No payment required now. We will contact you the day before your event to confirm, then send an invoice. Cash on delivery also accepted. All sales are final."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
