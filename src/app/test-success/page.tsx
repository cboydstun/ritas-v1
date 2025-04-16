"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TestSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Simulate a successful payment by redirecting to the success page
    // with test parameters
    const params = new URLSearchParams();
    params.append("orderId", "test-order-123");
    params.append("machineType", "double");
    params.append("mixers", "margarita,pina-colada");

    // Redirect to success page after a short delay
    const timer = setTimeout(() => {
      router.push(`/success?${params.toString()}`);
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-light via-margarita/10 to-teal/20 dark:from-charcoal dark:via-margarita/5 dark:to-teal/10">
      <div className="text-center p-8 bg-white/90 dark:bg-charcoal/50 backdrop-blur-lg rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-charcoal dark:text-white mb-4">
          Simulating Successful Payment
        </h1>
        <p className="text-charcoal/70 dark:text-white/70">
          Redirecting to success page in 2 seconds...
        </p>
        <div className="mt-4 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-margarita animate-[progress_2s_ease-in-out]"></div>
        </div>
      </div>
    </div>
  );
}
