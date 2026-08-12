"use client";

import { useEffect, useRef, useCallback } from "react";
import { OrderStep, OrderFormData, steps } from "./types";
import { trackEvent } from "@/lib/analytics";
import {
  buildAnalyticsItems,
  computeOrderTotal,
  type SettingsOverrides,
} from "./utils";
import { buildExtrasCatalog } from "@/lib/extras-catalog";
import { getConsent } from "@/lib/consent";

// Extract relevant form data for each step (without sensitive information)
const getFormContextForStep = (step: OrderStep, formData: OrderFormData) => {
  switch (step) {
    case "date":
      return {
        rentalDate: formData.rentalDate,
        returnDate: formData.returnDate,
        rentalTime: formData.rentalTime,
        returnTime: formData.returnTime,
      };
    case "machine":
      return {
        machineType: formData.machineType,
        capacity: formData.capacity,
        selectedMixers: formData.selectedMixers,
      };
    case "details":
      // Exclude sensitive information
      return {
        hasName: !!formData.customer?.name,
        hasEmail: !!formData.customer?.email,
        hasPhone: !!formData.customer?.phone,
        hasAddress: !!formData.customer?.address?.street,
        zipCode: formData.customer?.address?.zipCode,
      };
    case "extras":
      return {
        selectedExtras: formData.selectedExtras?.map((item) => item.id) || [],
        totalExtrasCount: formData.selectedExtras?.length || 0,
      };
    case "review":
      return {
        totalPrice: formData.price,
        hasExtras: (formData.selectedExtras?.length || 0) > 0,
      };
    default:
      return {};
  }
};

interface OrderFormTrackerProps {
  currentStep: OrderStep;
  formData: OrderFormData;
  /**
   * The admin pricing overrides, so `begin_checkout`'s items are priced from
   * the same catalog `purchase` uses. Without them an admin-added mixer
   * flavour would price at $0 in the checkout event and at its real price in
   * the purchase event, and GA4's funnel would show the cart changing value
   * between two steps that did not touch it.
   */
  settings?: SettingsOverrides;
}

export default function OrderFormTracker({
  currentStep,
  formData,
  settings,
}: OrderFormTrackerProps) {
  // Both of these were `useState`. Neither is rendered, and both are written
  // from inside the tracking effect, so each step change cost three renders
  // and churned `trackStepChange`'s identity. `useState(Date.now())` also
  // re-evaluated `Date.now()` on every render and threw the result away —
  // impure render work that misbehaves under the React Compiler.
  const lastStepRef = useRef<OrderStep | null>(null);
  const fingerprintRef = useRef<string | null>(null);
  // Never read before `trackStepChange` has written it: `timeSpentMs` is 0
  // until `lastStep` is set, and that only happens after the first write.
  const stepStartTimeRef = useRef<number>(0);

  const trackStepChange = useCallback(async () => {
    const lastStep = lastStepRef.current;

    // Opting out of cookies must actually stop the first-party fingerprint,
    // not just downgrade Google Consent Mode. The GA4 events above carry no
    // device identifier and stay.
    if (getConsent() === "denied") return;

    try {
      // Get fingerprint (only once per session). Imported lazily so the
      // fingerprinting library stays out of the /order entry bundle.
      if (!fingerprintRef.current) {
        const { getFingerprint } = await import("@thumbmarkjs/thumbmarkjs");
        fingerprintRef.current = await getFingerprint();
      }

      // Calculate time spent on previous step
      const timeSpentMs = lastStep ? Date.now() - stepStartTimeRef.current : 0;

      // Reset timer for new step
      stepStartTimeRef.current = Date.now();

      // Prepare data
      const data = {
        fingerprintHash: fingerprintRef.current,
        components: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          colorDepth: window.screen.colorDepth,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sessionStorage: !!window.sessionStorage,
          localStorage: !!window.localStorage,
          indexedDb: !!window.indexedDB,
          cookiesEnabled: navigator.cookieEnabled,
        },
        page: `/order/${currentStep}`, // Virtual path for analytics
        referrer: lastStep ? `/order/${lastStep}` : document.referrer || null,
        timeSpentMs, // Add time spent on previous step
        // Include relevant form data for this step (optional)
        formContext: getFormContextForStep(currentStep, formData),
      };

      // Send to API
      const response = await fetch("/api/v1/analytics/fingerprint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to send fingerprint data");
      }
    } catch (error) {
      console.error("Error tracking form step:", error);
    }
  }, [currentStep, formData]);

  useEffect(() => {
    // Only track if the step has changed
    if (currentStep !== lastStepRef.current) {
      // GA4 first, and synchronously: the wizard never changes the URL, so
      // without this GA4 sees a single /order pageview and no funnel at all.
      // Kept out of `trackStepChange` because that awaits a lazy import and a
      // fetch, neither of which the funnel should depend on.
      const stepIndex = steps.findIndex((entry) => entry.id === currentStep);
      trackEvent("order_step", {
        step_id: currentStep,
        step_index: stepIndex + 1,
        step_name: steps[stepIndex]?.label ?? currentStep,
      });

      if (currentStep === "review") {
        // Items are attached here so `begin_checkout` and `purchase` describe
        // the same cart. Without them GA4's ecommerce funnel had item detail
        // only at the final step, which makes "which add-on gets abandoned"
        // unanswerable.
        const totals = computeOrderTotal(formData, settings);
        trackEvent("begin_checkout", {
          value: totals.finalTotal,
          currency: "USD",
          machine_type: formData.machineType,
          items: buildAnalyticsItems(
            formData,
            totals,
            buildExtrasCatalog({
              extras: settings?.extras,
              mixers: settings?.mixers,
            }),
          ),
        });
      }

      trackStepChange();
      lastStepRef.current = currentStep;
    }
  }, [currentStep, trackStepChange, formData, settings]);

  return null; // This component doesn't render anything
}
