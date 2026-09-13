"use client";

import { useEffect, useRef } from "react";
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
  PayPalGuestPaymentButton,
  PayLaterOneTimePaymentButton,
  useEligibleMethods,
  usePayPal,
  INSTANCE_LOADING_STATE,
} from "@paypal/react-paypal-js/sdk-v6";

/** Set at build time, so an unset value means the feature ships dark. */
const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

export interface PayPalCheckoutProps {
  /**
   * Opens (or reprices) the hold and returns the PayPal order id.
   *
   * Called on **every** button click, so it must be idempotent per cart —
   * see `reuseBookingId` in `@/lib/booking/createBooking`.
   */
  createOrder: () => Promise<string>;
  /** Captures the payment. Must not resolve until the capture has landed. */
  onApprove: (orderId: string) => Promise<void>;
  onCancel: () => void;
  onError: (error: Error) => void;
  /** Drives Pay Later eligibility, which is threshold-based. */
  amountUsd: number;
  disabled?: boolean;
}

/**
 * The PayPal, card and Pay Later buttons on the review step.
 *
 * `@paypal/react-paypal-js` v10 targets the PayPal JS SDK **v6**: the v8
 * `PayPalScriptProvider` / `PayPalButtons` API does not exist here, each
 * funding source is its own component, and `environment` is a required prop
 * because the client id no longer selects it.
 *
 * Venmo is absent from `components` deliberately — that is what disables it,
 * and it is why no venmo.com origin appears in the CSP.
 */
export default function PayPalCheckout(props: PayPalCheckoutProps) {
  if (!CLIENT_ID) return null;

  return (
    <PayPalProvider
      clientId={CLIENT_ID}
      environment="production"
      components={["paypal-payments", "paypal-guest-payments"]}
      pageType="checkout"
    >
      <PayPalButtons {...props} />
    </PayPalProvider>
  );
}

function PayPalButtons({
  createOrder,
  onApprove,
  onCancel,
  onError,
  amountUsd,
  disabled = false,
}: PayPalCheckoutProps) {
  const { loadingStatus } = usePayPal();

  // The SDK memoises the callbacks it is handed, so a plain closure here goes
  // stale as the cart changes. Refs are read at call time. The alternative —
  // rebuilding the buttons whenever anything changes — tears them down and
  // re-runs the eligibility request on every keystroke.
  const handlers = useRef({ createOrder, onApprove, onCancel, onError });
  // Written in an effect, not during render: the effect runs after every
  // commit and long before any button click, so the callbacks the SDK
  // eventually invokes are always the latest ones.
  useEffect(() => {
    handlers.current = { createOrder, onApprove, onCancel, onError };
  });

  const shared = {
    disabled,
    createOrder: async () => ({
      orderId: await handlers.current.createOrder(),
    }),
    // Must return the promise: the SDK keeps its own spinner up until the
    // capture resolves, and a bare call would let the buyer navigate away
    // mid-capture.
    onApprove: async ({ orderId }: { orderId: string }) =>
      handlers.current.onApprove(orderId),
    onCancel: () => handlers.current.onCancel(),
    onError: (error: unknown) =>
      handlers.current.onError(
        error instanceof Error ? error : new Error("PayPal payment error"),
      ),
  };

  // PayPal failing to load is not the customer's problem, and the invoice
  // button below it still works — so this renders nothing rather than an
  // error the customer can do nothing about.
  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) return null;

  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) {
    return (
      <div
        className="h-28 rounded-lg bg-charcoal/5 dark:bg-white/5 animate-pulse motion-reduce:animate-none"
        role="status"
        aria-label="Loading payment options"
      />
    );
  }

  return (
    <div className="space-y-2">
      <PayPalOneTimePaymentButton {...shared} type="pay" />
      <PayPalGuestPaymentButton {...shared} />
      <PayLaterButton shared={shared} amountUsd={amountUsd} />
    </div>
  );
}

/**
 * Pay Later renders only once eligibility says the buyer can use it — the
 * button reads its own country and product code out of that response, and has
 * neither until it has been fetched.
 */
function PayLaterButton({
  shared,
  amountUsd,
}: {
  shared: React.ComponentProps<typeof PayLaterOneTimePaymentButton>;
  amountUsd: number;
}) {
  const { eligiblePaymentMethods, isLoading } = useEligibleMethods({
    payload: {
      amount: amountUsd.toFixed(2),
      currencyCode: "USD",
      paymentFlow: "ONE_TIME_PAYMENT",
    },
  });

  if (isLoading || !eligiblePaymentMethods?.isEligible("paylater")) return null;

  return <PayLaterOneTimePaymentButton {...shared} />;
}
