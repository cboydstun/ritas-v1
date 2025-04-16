import { render, screen } from "@testing-library/react";
import PaymentStep from "../PaymentStep";
import "@testing-library/jest-dom";
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock the PayPalScriptProvider and PayPalCheckout components
jest.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/PayPalCheckout", () => ({
  PayPalCheckout: ({ onSuccess }: { onSuccess: (orderId: string) => void }) => (
    <button onClick={() => onSuccess("test-order-123")}>Mock PayPal Button</button>
  ),
}));

// Mock window.location
const mockAssign = jest.fn();
Object.defineProperty(window, "location", {
  value: {
    href: "",
    assign: mockAssign,
  },
  writable: true,
});

describe("PaymentStep", () => {
  const mockFormData = {
    machineType: "single" as const,
    capacity: 15 as const,
    selectedMixers: ["margarita"],
    selectedExtras: [],
    price: 149.95,
    rentalDate: "2025-04-15",
    rentalTime: "12:00",
    returnDate: "2025-04-16",
    returnTime: "12:00",
    customer: {
      name: "Test User",
      email: "test@example.com",
      phone: "123-456-7890",
      address: {
        street: "123 Test St",
        city: "Test City",
        state: "TX",
        zipCode: "12345",
      },
    },
    notes: "",
  };

  beforeEach(() => {
    // Reset mocks
    mockAssign.mockReset();
    window.location.href = "";
  });

  it("renders payment details", () => {
    render(<PaymentStep formData={mockFormData} onInputChange={jest.fn()} error={null} />);
    
    expect(screen.getByText(/Payment Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Amount:/i)).toBeInTheDocument();
  });

  it("redirects to success page on successful payment", () => {
    render(<PaymentStep formData={mockFormData} onInputChange={jest.fn()} error={null} />);
    
    // Find and click the mock PayPal button
    const paypalButton = screen.getByText("Mock PayPal Button");
    paypalButton.click();
    
    // Check that window.location.href was set to the success page with correct parameters
    expect(window.location.href).toContain("/success");
    expect(window.location.href).toContain("orderId=test-order-123");
    expect(window.location.href).toContain("machineType=single");
    expect(window.location.href).toContain("mixers=margarita");
  });
});
