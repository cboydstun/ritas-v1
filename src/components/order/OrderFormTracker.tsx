"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getFingerprint } from "@thumbmarkjs/thumbmarkjs";
import { OrderStep, OrderFormData } from "./types";

interface OrderFormTrackerProps {
  currentStep: OrderStep;
  formData: OrderFormData;
}

export default function OrderFormTracker({ currentStep, formData }: OrderFormTrackerProps) {
  const [lastStep, setLastStep] = useState<OrderStep | null>(null);
  const fingerprintRef = useRef<string | null>(null);
  
  const trackStepChange = useCallback(async () => {
    try {
      // Get fingerprint (only once per session)
      if (!fingerprintRef.current) {
        fingerprintRef.current = await getFingerprint();
      }
      
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
        // Include relevant form data for this step (optional)
        formContext: getFormContextForStep(currentStep, formData)
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
  }, [currentStep, lastStep, formData]);
  
  useEffect(() => {
    // Only track if the step has changed
    if (currentStep !== lastStep) {
      trackStepChange();
      setLastStep(currentStep);
    }
  }, [currentStep, lastStep, trackStepChange]);
  
  // Extract relevant form data for each step (without sensitive information)
  const getFormContextForStep = (step: OrderStep, formData: OrderFormData) => {
    switch (step) {
      case "delivery":
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
      case "payment":
        return {
          totalPrice: formData.price,
        };
      default:
        return {};
    }
  };
  
  return null; // This component doesn't render anything
}
