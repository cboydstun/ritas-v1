import { render, screen } from "@testing-library/react";
import React from "react";
import SuccessPage from "../page";
import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
// Feed URLSearchParams directly into the context that useSearchParams reads.
// When this context is provided, useSearchParams() returns synchronously (no Suspense).
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

jest.mock("next/script", () => ({
  __esModule: true,
  default: () => null,
}));

const mockParams = new URLSearchParams(
  "bookingId=test-order-123&machineType=double&mixers=margarita,pina-colada",
);

/** The paid branch, which `buildSuccessUrl` flags with `paid=1`. */
const paidParams = new URLSearchParams(
  "bookingId=test-order-123&machineType=double&paid=1",
);

function renderWithSearchParams(ui: React.ReactElement) {
  return render(
    <SearchParamsContext.Provider value={mockParams}>
      {ui}
    </SearchParamsContext.Provider>,
  );
}

describe("Success Page", () => {
  it("renders the success message", () => {
    renderWithSearchParams(<SuccessPage />);

    // h1 contains "Order" (text node) + <span>Confirmed</span>; check via heading role
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Order.*Confirmed/i);
    expect(screen.getByText(/Thank you for your order/i)).toBeInTheDocument();
  });

  it("promises an invoice when the booking was not paid online", () => {
    renderWithSearchParams(<SuccessPage />);

    expect(screen.getAllByText(/send you an invoice/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryAllByText(/Paid in Full/i)).toHaveLength(0);
  });

  // `isManualInvoicing` used to be `Boolean(bookingId)`, which is true on both
  // paths — so a customer who had just paid was told an invoice was coming and
  // that no deposit was required today.
  it("does not promise an invoice to a customer who already paid", () => {
    render(
      <SearchParamsContext.Provider value={paidParams}>
        <SuccessPage />
      </SearchParamsContext.Provider>,
    );

    expect(screen.getAllByText(/Paid in Full/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/send you an invoice/i)).toHaveLength(0);
    expect(screen.queryAllByText(/no deposit required today/i)).toHaveLength(0);
  });

  it("displays the order ID", () => {
    renderWithSearchParams(<SuccessPage />);

    // Rendered twice on purpose: once in Order Information, and again in the
    // "quote your booking id when you call" line of SuccessNextActions.
    expect(screen.getAllByText(/test-order-123/i).length).toBeGreaterThan(0);
  });

  it("shows order details from URL parameters", () => {
    renderWithSearchParams(<SuccessPage />);

    expect(screen.getByText(/double tank/i)).toBeInTheDocument();
    // "Margarita Mixer" appears in both the mixer list and prep guide
    expect(screen.getAllByText(/margarita mixer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/piña colada mixer/i).length).toBeGreaterThan(0);
  });

  it("has a return to home button", () => {
    render(<SuccessPage />);

    const homeButton = screen.getByRole("link", { name: /return home/i });
    expect(homeButton).toBeInTheDocument();
    expect(homeButton).toHaveAttribute("href", "/");
  });
});
