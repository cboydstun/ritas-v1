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

  // Get order details from URL parameters
  const orderId = searchParams.get("orderId") || "Unknown";
  const machineType = searchParams.get("machineType") || "single";
  const mixersParam = searchParams.get("mixers") || "";
  const mixers = mixersParam ? mixersParam.split(",") : [];

  // Generate JSON-LD data
  const jsonLdData = generateOrderJsonLd(orderId, machineType);

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
                <span className="font-medium">Order ID:</span> {orderId}
              </p>
              <p className="text-charcoal/70 dark:text-white/70">
                <span className="font-medium">Status:</span> Confirmed
              </p>
            </div>

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

            <div className="bg-white/80 dark:bg-charcoal/30 rounded-xl p-6">
              <h3 className="font-semibold text-lg text-charcoal dark:text-white mb-4">
                Next Steps
              </h3>
              <p className="text-charcoal/70 dark:text-white/70 mb-2">
                We have sent a confirmation email with all the details of
                your order.
              </p>
              <p className="text-charcoal/70 dark:text-white/70">
                Our team will contact you before your delivery date to
                confirm the details.
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
      <p className="mt-4 text-lg text-charcoal/70 dark:text-white/70">Loading order details...</p>
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
