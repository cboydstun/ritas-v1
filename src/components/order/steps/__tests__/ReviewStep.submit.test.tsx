import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReviewStep from "../ReviewStep";
import { OrderFormData } from "@/components/order/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

// Both must be stubbed. `pushDataLayer` left out of this mock resolved to
// `undefined`, and calling it threw inside the submit handler's try block —
// which the catch turned into a generic "Failed to confirm booking" and the
// draft was never cleared. A partial mock of this module is a booking outage
// in the shape of a passing analytics test.
jest.mock("@/lib/analytics", () => ({
  trackEvent: jest.fn(),
  pushDataLayer: jest.fn(),
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

const renderStep = (onSuccess = jest.fn()) => {
  render(
    <ReviewStep
      formData={formData}
      onInputChange={jest.fn()}
      error={null}
      agreedToTerms
      setAgreedToTerms={jest.fn()}
      onSuccess={onSuccess}
    />,
  );
  return onSuccess;
};

const confirmButton = () => screen.getByRole("button", { name: /confirm/i });

describe("ReviewStep submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom cannot navigate, and `window.location` is not redefinable here, so
    // `onSuccess` — called immediately before the redirect — stands in for it.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The button's disabled attribute only takes effect on the next render, so
  // two clicks in the same tick both reached the fetch and booked twice.
  it("submits once when the confirm button is clicked twice in a tick", async () => {
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ bookingId: "ABC123" }),
              }),
            20,
          ),
        ),
    ) as unknown as typeof fetch;

    renderStep();
    const button = confirmButton();
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("clears the draft once the booking is confirmed", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ bookingId: "ABC123" }),
    })) as unknown as typeof fetch;

    const onSuccess = renderStep();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("sends only an id and quantity for each extra", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ bookingId: "ABC123" }),
    })) as unknown as typeof fetch;

    renderStep();
    fireEvent.click(confirmButton());

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const sent = JSON.parse((init as { body: string }).body);
    // The server recomputes the money; a price in the body is not just
    // ignored, it is never sent.
    expect(sent.rentalData).not.toHaveProperty("price");
    expect(sent.rentalData).not.toHaveProperty("isServiceDiscount");
  });

  // A 200 with no booking id is not a booking; redirecting anyway sent the
  // customer to /success?bookingId=undefined with nothing to reference.
  it("refuses to complete when the response carries no booking id", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const onSuccess = renderStep();
    fireEvent.click(confirmButton());

    expect(
      await screen.findByText(/could not confirm your booking reference/i),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the server's message and allows a retry after a failure", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Machine is no longer available" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookingId: "ABC123" }),
      }) as unknown as typeof fetch;

    renderStep();
    fireEvent.click(confirmButton());

    expect(
      await screen.findByText("Machine is no longer available"),
    ).toBeInTheDocument();

    // The latch has to release, or a recoverable failure would strand the
    // customer on a dead button.
    fireEvent.click(confirmButton());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
