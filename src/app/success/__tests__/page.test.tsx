import { render, screen } from "@testing-library/react";
import SuccessPage from "../page";
import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";

// Mock the useSearchParams hook
jest.mock("next/navigation", () => ({
  useSearchParams: () => {
    return {
      get: (param: string) => {
        if (param === "orderId") return "test-order-123";
        if (param === "machineType") return "double";
        if (param === "mixers") return "margarita,pina-colada";
        return null;
      },
    };
  },
}));

describe("Success Page", () => {
  it("renders the success message", () => {
    render(<SuccessPage />);

    // Check for success message
    expect(screen.getByText(/Order Confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Thank you for your order/i)).toBeInTheDocument();
  });

  it("displays the order ID", () => {
    render(<SuccessPage />);

    // Check for order ID
    expect(screen.getByText(/test-order-123/i)).toBeInTheDocument();
  });

  it("shows order details from URL parameters", () => {
    render(<SuccessPage />);

    // Check for machine type and mixers
    expect(screen.getByText(/double/i)).toBeInTheDocument();
    expect(screen.getByText(/margarita/i)).toBeInTheDocument();
    expect(screen.getByText(/pina-colada/i)).toBeInTheDocument();
  });

  it("has a return to home button", () => {
    render(<SuccessPage />);

    // Check for home button
    const homeButton = screen.getByRole("link", { name: /return home/i });
    expect(homeButton).toBeInTheDocument();
    expect(homeButton).toHaveAttribute("href", "/");
  });
});
