"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { mixerDetails, MixerType } from "@/lib/rental-data";
import Script from "next/script";
import { generateOrderJsonLd } from "./jsonld";
import { Suspense } from "react";

// Component that uses useSearchParams
function OrderDetails() {
  const searchParams = useSearchParams();

  // Get order details from URL parameters - handle both old PayPal flow and new booking flow
  const orderId = searchParams.get("orderId");
  const bookingId = searchParams.get("bookingId");
  const displayId = bookingId || orderId || "Unknown";
  const isManualInvoicing = Boolean(bookingId); // New booking flow uses bookingId

  const machineType = searchParams.get("machineType") || "single";
  const mixersParam = searchParams.get("mixers") || "";
  const mixers = mixersParam ? mixersParam.split(",") : [];

  // Generate JSON-LD data
  const jsonLdData = generateOrderJsonLd(displayId, machineType);

  return (
    <>
      <Script
        id="order-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />

      <div className="text-center mb-12">
        <div className="mb-8 inline-block">
          <span className="inline-block px-4 py-2 rounded-full bg-green-500/20 dark:bg-green-500/10 text-charcoal dark:text-white text-sm font-semibold tracking-wide uppercase animate-bounce">
            🎉 Success!
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal dark:text-white mb-6 tracking-tight">
          Order
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-teal to-margarita mt-2">
            Confirmed
          </span>
        </h1>
        <p className="text-xl text-charcoal/70 dark:text-white/70 max-w-2xl mx-auto">
          Thank you for your order! We have received your rental request and
          will be in touch soon.
        </p>
      </div>

      <div className="bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl p-8 relative overflow-hidden mb-8">
        {/* Decorative Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl" />

        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-charcoal dark:text-white mb-6">
            Order Details
          </h2>

          <div className="space-y-4">
            <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                Order Information
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                <span className="font-medium">
                  {isManualInvoicing ? "Booking ID:" : "Order ID:"}
                </span>{" "}
                {displayId}
              </p>
              <p className="text-charcoal/70 dark:text-white/70">
                <span className="font-medium">Status:</span> Confirmed
              </p>
            </div>

            {isManualInvoicing && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
                      Payment Information
                    </h3>
                    <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                      We will send you an invoice for payment separately. You
                      can pay by cash, check, or card when we deliver your
                      rental.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                Rental Details
              </h3>
              <p className="text-charcoal/70 dark:text-white/70">
                <span className="font-medium">Machine Type:</span>{" "}
                {machineType.charAt(0).toUpperCase() + machineType.slice(1)}{" "}
                Tank
              </p>
              {mixers.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-charcoal/70 dark:text-white/70">
                    Selected Mixers:
                  </p>
                  <ul className="list-disc list-inside text-charcoal/70 dark:text-white/70 ml-4">
                    {mixers.map((mixer, index) => (
                      <li key={index}>
                        {mixerDetails[mixer as MixerType]?.label || mixer}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Mixer & Drink Preparation Guide */}
            {mixers.length > 0 || machineType
              ? (() => {
                  const tankCount =
                    machineType === "single"
                      ? 1
                      : machineType === "double"
                        ? 2
                        : 3;
                  const capacityL =
                    machineType === "single"
                      ? 15
                      : machineType === "double"
                        ? 30
                        : 45;

                  return (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                      <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                        🍹 Mixer &amp; Drink Preparation Guide
                      </h3>
                      <p className="text-sm text-charcoal/60 dark:text-white/50 mb-4">
                        Your machine holds <strong>{capacityL}L</strong> total
                        across {tankCount} tank{tankCount > 1 ? "s" : ""} (
                        {Math.round(capacityL / tankCount)}L per tank).
                      </p>

                      <ul className="space-y-3 mb-5">
                        {Array.from({ length: tankCount }, (_, i) => {
                          const mixerKey = mixers[i] as MixerType | undefined;
                          const mixerLabel = mixerKey
                            ? (mixerDetails[mixerKey]?.label ?? mixerKey)
                            : null;
                          const tankLabel =
                            tankCount === 1 ? "Your Tank" : `Tank ${i + 1}`;

                          return mixerLabel ? (
                            <li
                              key={i}
                              className="p-4 bg-white dark:bg-charcoal/40 border-l-4 border-green-400 rounded-lg"
                            >
                              <p className="font-semibold text-charcoal dark:text-white mb-1">
                                {tankLabel} — {mixerLabel}
                              </p>
                              <ul className="text-sm text-charcoal/70 dark:text-white/70 space-y-1">
                                <li>
                                  ✅ <strong>We bring:</strong> 1 × ½-gallon (64
                                  oz) jug of {mixerLabel} concentrate
                                </li>
                                <li>
                                  💧 <strong>You add:</strong> ~2 gallons of
                                  water → ~2.5 gallons total (~40 servings of 8
                                  oz)
                                </li>
                                <li>
                                  🥃 <strong>Optional BYOB:</strong> up to 1.75
                                  L (one &ldquo;handle&rdquo;) of liquor per
                                  tank if desired
                                </li>
                              </ul>
                            </li>
                          ) : (
                            <li
                              key={i}
                              className="p-4 bg-white dark:bg-charcoal/40 border-l-4 border-gray-300 dark:border-gray-600 rounded-lg"
                            >
                              <p className="font-semibold text-charcoal dark:text-white mb-1">
                                {tankLabel} — No Mixer Selected
                              </p>
                              <p className="text-sm text-charcoal/70 dark:text-white/70">
                                You will be providing your own mixer and water.
                                Each tank holds up to 1.75 L of liquor if
                                desired.
                              </p>
                            </li>
                          );
                        })}
                      </ul>

                      {/* TABC / no-alcohol warning */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-lg p-4">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                          🚫 Alcohol Policy — Texas TABC
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          We are prohibited by Texas law from providing or
                          selling alcohol. If you choose to add your own, please
                          limit to{" "}
                          <strong>
                            one 1.75 L bottle (a &ldquo;handle&rdquo;) per tank
                            maximum
                          </strong>{" "}
                          and always <strong>drink responsibly</strong>. 🥃
                        </p>
                      </div>
                    </div>
                  );
                })()
              : null}

            {/* Payment Process */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-3">
                💳 What Happens Next — Payment
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-charcoal/70 dark:text-white/70 text-sm">
                <li>
                  <strong>Day before your event</strong> — we will call or text
                  you to confirm all booking details (date, time, address).
                </li>
                <li>
                  <strong>After confirmation</strong> — we will send you an
                  invoice you can pay online (card, PayPal, etc.).
                </li>
                <li>
                  <strong>Cash on delivery</strong> is also accepted — no
                  deposit required today.
                </li>
              </ol>
              <p className="mt-3 text-xs text-charcoal/50 dark:text-white/40 italic">
                All sales are final — no refunds. Please reference your Booking
                ID in any communications with us.
              </p>
            </div>

            <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                Next Steps
              </h3>
              <p className="text-charcoal/70 dark:text-white/70 mb-2">
                We have sent a confirmation email with all the details of your
                order.
              </p>
              <p className="text-charcoal/70 dark:text-white/70">
                Our team will contact you the{" "}
                <strong>day before your event</strong> to confirm the details
                and arrange payment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Loading fallback component
function OrderDetailsLoading() {
  return (
    <div className="text-center py-12">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-margarita"></div>
      <p className="mt-4 text-lg text-charcoal/70 dark:text-white/70">
        Loading order details...
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10 py-12 relative">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 dark:bg-orange/5 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 dark:bg-pink/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 dark:bg-margarita/5 rounded-full blur-xl animate-pulse" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Wrap the component that uses useSearchParams in a Suspense boundary */}
        <Suspense fallback={<OrderDetailsLoading />}>
          <OrderDetails />
        </Suspense>

        <div className="text-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-margarita hover:bg-margarita/90 text-white font-medium rounded-xl transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
