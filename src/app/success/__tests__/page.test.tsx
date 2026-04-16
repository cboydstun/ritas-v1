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
  "orderId=test-order-123&machineType=double&mixers=margarita,pina-colada",
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

  it("displays the order ID", () => {
    renderWithSearchParams(<SuccessPage />);

    expect(screen.getByText(/test-order-123/i)).toBeInTheDocument();
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
