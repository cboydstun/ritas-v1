import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReviewStep from "../ReviewStep";
import { trackEvent } from "@/lib/analytics";
import { OrderFormData } from "@/components/order/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// Both must be stubbed, and `pushDataLayerThen` must invoke its callback —
// that callback is what performs the redirect. See the note in
// ReviewStep.submit.test.tsx; a partial mock here is a booking outage in the
// shape of a passing analytics test. `LEAD_VALUES` and `ANALYTICS_CURRENCY`
// are spread from the real module rather than restated.
jest.mock("@/lib/analytics", () => ({
  ...jest.requireActual("@/lib/analytics"),
  trackEvent: jest.fn(),
  pushDataLayerThen: jest.fn(
    (_event: string, _params: Record<string, unknown>, done: () => void) =>
      done(),
  ),
}));

jest.mock("@/lib/enhanced-conversions", () => ({
  hashUserData: jest.fn().mockResolvedValue(undefined),
}));

/**
 * Stands in for the PayPal SDK, exposing the callbacks the real buttons would
 * eventually invoke so the flow can be driven without a live SDK.
 */
const paypalHandlers: {
  createOrder?: () => Promise<string>;
  onApprove?: (orderId: string) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
} = {};

jest.mock("@/components/order/PayPalCheckout", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    Object.assign(paypalHandlers, props);
    return (
      <button
        type="button"
        data-testid="paypal-button"
        disabled={props.disabled as boolean}
      >
        PayPal
      </button>
    );
  },
}));

const formData: OrderFormData = {
  machineType: "single",
  capacity: 15,
  selectedMixers: ["margarita"],
  selectedExtras: [],
  price: 149.95,
  rentalDate: "2026-09-01",
  rentalTime: "12:00",
  returnDate: "2026-09-02",
  returnTime: "12:00",
  customer: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "210-555-0134",
    address: {
      street: "1 Alamo Plaza",
      city: "San Antonio",
      state: "TX",
      zipCode: "78205",
    },
  },
  notes: "",
  isServiceDiscount: false,
} as OrderFormData;

const renderStep = (props: Record<string, unknown> = {}) => {
  const onSuccess = jest.fn();
  render(
    <ReviewStep
      formData={formData}
      onInputChange={jest.fn()}
      error={null}
      agreedToTerms
      setAgreedToTerms={jest.fn()}
      onSuccess={onSuccess}
      {...props}
    />,
  );
  return onSuccess;
};

/** The URLs every fetch was sent to, in order. */
const fetchedUrls = () =>
  (global.fetch as jest.Mock).mock.calls.map((c) => c[0] as string);

const bodyOf = (call: number) =>
  JSON.parse((global.fetch as jest.Mock).mock.calls[call][1].body as string);

describe("ReviewStep — PayPal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(paypalHandlers)) {
      delete (paypalHandlers as Record<string, unknown>)[key];
    }
    jest.spyOn(console, "error").mockImplementation(() => {});

    global.fetch = jest.fn(async (url: string) => {
      if (String(url).includes("create-order")) {
        return {
          ok: true,
          json: async () => ({ id: "ORDER-1", bookingId: "BOOKID1234" }),
        };
      }
      if (String(url).includes("capture-order")) {
        return { ok: true, json: async () => ({ bookingId: "BOOKID1234" }) };
      }
      if (String(url).includes("release-hold")) {
        return { ok: true, json: async () => ({ released: true }) };
      }
      return { ok: true, json: async () => ({ bookingId: "BOOKID1234" }) };
    }) as unknown as typeof fetch;
  });

  afterEach(() => jest.restoreAllMocks());

  describe("the feature gate", () => {
    // The client id is inlined at build time. Unset means checkout behaves
    // exactly as it did before this feature existed.
    it("renders no PayPal buttons and no divider when unconfigured", () => {
      renderStep();

      expect(screen.queryByTestId("paypal-button")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /confirm booking/i }),
      ).toBeInTheDocument();
    });
  });

  describe("with PayPal configured", () => {
    // The component reads the env var in its body, not at module scope, so
    // setting it here is enough — re-importing the module would load a second
    // copy of React and null out every hook.
    beforeEach(() => {
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "test-client-id";
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    });

    /** Renders, then waits for the lazily-loaded stub to hand its props over. */
    const renderConfigured = async (props: Record<string, unknown> = {}) => {
      const onSuccess = renderStep(props);
      await screen.findByTestId("paypal-button");
      return onSuccess;
    };

    it("renders the buttons and demotes the invoice button", async () => {
      renderStep();

      // `next/dynamic` resolves the import in an effect, so the buttons are
      // not in the first synchronous render.
      expect(await screen.findByTestId("paypal-button")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /invoice me later/i }),
      ).toBeInTheDocument();
    });

    it("opens an order and captures it, then finishes the booking", async () => {
      const onSuccess = await renderConfigured();

      const orderId = await paypalHandlers.createOrder!();
      expect(orderId).toBe("ORDER-1");
      expect(fetchedUrls()[0]).toContain("/api/v1/paypal/create-order");

      await paypalHandlers.onApprove!("ORDER-1");

      expect(fetchedUrls()[1]).toContain("/api/v1/paypal/capture-order");
      // Only the order id — the body is never a source of money.
      expect(bodyOf(1)).toEqual({ orderId: "ORDER-1" });
      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    });

    // `method` is a registered GA4 custom dimension, so the two paths are
    // distinguishable in reporting.
    it("reports the purchase with method: paypal", async () => {
      await renderConfigured();

      await paypalHandlers.createOrder!();
      await paypalHandlers.onApprove!("ORDER-1");

      await waitFor(() =>
        expect(trackEvent).toHaveBeenCalledWith(
          "purchase",
          expect.objectContaining({
            transaction_id: "BOOKID1234",
            method: "paypal",
          }),
        ),
      );
    });

    it("reports the invoice path with method: invoice", async () => {
      await renderConfigured();

      fireEvent.click(
        screen.getByRole("button", { name: /invoice me later/i }),
      );

      await waitFor(() =>
        expect(trackEvent).toHaveBeenCalledWith(
          "purchase",
          expect.objectContaining({ method: "invoice" }),
        ),
      );
    });

    describe("one cart, one hold", () => {
      // Without this a buyer who cancels and clicks a different funding source
      // holds two units for one cart.
      it("sends the held booking id on a second attempt", async () => {
        await renderConfigured();

        await paypalHandlers.createOrder!();
        expect(bodyOf(0).reuseBookingId).toBeUndefined();

        paypalHandlers.onCancel!();
        await waitFor(() =>
          expect(fetchedUrls().some((u) => u.includes("release-hold"))).toBe(
            true,
          ),
        );
        await paypalHandlers.createOrder!();

        // The booking id deliberately outlives the release: if the release did
        // not land, this reprices the surviving hold instead of taking a
        // second unit. When it did land, the server finds nothing and inserts.
        const second = fetchedUrls().findIndex(
          (u, i) => i > 0 && u.includes("create-order"),
        );
        expect(bodyOf(second).reuseBookingId).toBe("BOOKID1234");
      });

      it("releases the hold when the buyer cancels", async () => {
        await renderConfigured();

        await paypalHandlers.createOrder!();
        paypalHandlers.onCancel!();

        await waitFor(() =>
          expect(fetchedUrls().some((u) => u.includes("release-hold"))).toBe(
            true,
          ),
        );
        expect(bodyOf(1)).toEqual({ orderId: "ORDER-1" });
      });

      // Otherwise, on the last unit, the buyer is 409'd by their own
      // abandoned hold.
      it("releases the hold before falling back to the invoice path", async () => {
        await renderConfigured();

        await paypalHandlers.createOrder!();
        paypalHandlers.onCancel!();
        await waitFor(() =>
          expect(fetchedUrls().some((u) => u.includes("release-hold"))).toBe(
            true,
          ),
        );

        fireEvent.click(
          screen.getByRole("button", { name: /invoice me later/i }),
        );

        await waitFor(() =>
          expect(fetchedUrls().some((u) => u.includes("save-booking"))).toBe(
            true,
          ),
        );
        const urls = fetchedUrls();
        expect(urls.indexOf("/api/v1/paypal/release-hold")).toBeLessThan(
          urls.indexOf("/api/save-booking"),
        );
      });
    });

    describe("latches", () => {
      // The disabled prop is advisory — the SDK still opens a session on a
      // programmatic click — and this checkbox is the only consent artefact.
      it("refuses to open an order when the terms are unchecked", async () => {
        await renderConfigured({ agreedToTerms: false });

        await expect(paypalHandlers.createOrder!()).rejects.toThrow(
          /Terms not accepted/,
        );
        expect(global.fetch).not.toHaveBeenCalled();
        expect(paypalHandlers.disabled).toBe(true);
      });

      it("blocks the invoice button while the popup is open", async () => {
        await renderConfigured();

        await paypalHandlers.createOrder!();
        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: /invoice me later/i }),
          ).toBeDisabled(),
        );
      });

      // onApprove can fire twice on a double tap; capturing twice is the one
      // thing this flow must not do.
      it("captures once when approve fires twice", async () => {
        await renderConfigured();

        await paypalHandlers.createOrder!();
        await Promise.all([
          paypalHandlers.onApprove!("ORDER-1"),
          paypalHandlers.onApprove!("ORDER-1"),
        ]);

        const captures = fetchedUrls().filter((u) =>
          u.includes("capture-order"),
        );
        expect(captures).toHaveLength(1);
      });
    });

    describe("failures", () => {
      // If the SDK did not route the throw to onError, the invoice button
      // would stay disabled and the customer could not book at all.
      it("re-enables the invoice button when create-order refuses", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            message: "All single tank machines are booked",
          }),
        });
        await renderConfigured();

        await expect(paypalHandlers.createOrder!()).rejects.toThrow();

        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: /invoice me later/i }),
          ).not.toBeDisabled(),
        );
        expect(
          screen.getByText(/All single tank machines are booked/i),
        ).toBeInTheDocument();
      });

      it("surfaces the server's message when create-order refuses", async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            message: "All single tank machines are booked",
          }),
        });
        await renderConfigured();

        await expect(paypalHandlers.createOrder!()).rejects.toThrow(
          /All single tank machines are booked/,
        );
      });

      // The money may well have moved, so this must not invite a retry or
      // quietly hand the unit back.
      it("shows a call-us message when the capture fails", async () => {
        await renderConfigured();
        await paypalHandlers.createOrder!();

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "We could not confirm your payment." }),
        });
        await paypalHandlers.onApprove!("ORDER-1");

        await waitFor(() =>
          expect(
            screen.getByText(/could not confirm your payment/i),
          ).toBeInTheDocument(),
        );
        expect(fetchedUrls().some((u) => u.includes("release-hold"))).toBe(
          false,
        );
      });

      it("does not finish the booking when the capture returns no id", async () => {
        await renderConfigured();
        await paypalHandlers.createOrder!();

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });
        await paypalHandlers.onApprove!("ORDER-1");

        expect(trackEvent).not.toHaveBeenCalledWith(
          "purchase",
          expect.anything(),
        );
      });

      it("points the buyer at the invoice path on an SDK error", async () => {
        await renderConfigured();
        await paypalHandlers.createOrder!();

        paypalHandlers.onError!(new Error("popup blocked"));

        await waitFor(() =>
          expect(screen.getByText(/we will invoice you/i)).toBeInTheDocument(),
        );
      });
    });
  });
});
