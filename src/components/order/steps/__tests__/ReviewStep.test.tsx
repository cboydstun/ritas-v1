import { render, screen, fireEvent } from "@testing-library/react";
import ReviewStep from "../ReviewStep";
import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
import { MixerType } from "@/lib/rental-data";

describe("ReviewStep", () => {
  const mockFormData = {
    machineType: "single" as const,
    capacity: 15 as const,
    selectedMixers: ["margarita" as MixerType],
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
    // Issue 3: isServiceDiscount now required and lives in formData
    isServiceDiscount: false,
  };

  const mockSetAgreedToTerms = jest.fn();

  it("renders review details", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    expect(
      screen.getByText(/Review & Confirm Your Order/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Selected Machine/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing Details/i)).toBeInTheDocument();
  });

  // The service/military discount is applied manually at invoicing time, not
  // self-served in the wizard. This locks that in — a checkbox reappearing here
  // would silently let customers grant themselves 10% off.
  it("offers no self-serve service discount control", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    expect(screen.queryByLabelText(/military|service discount/i)).toBeNull();
  });

  it("still honours a service discount set outside the wizard", () => {
    const { rerender } = render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    const initialTotal = parseFloat(
      screen.getByText(/Total Amount:/i).textContent?.replace(/[^0-9.]/g, "") ||
        "0",
    );

    rerender(
      <ReviewStep
        formData={{ ...mockFormData, isServiceDiscount: true }}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    const newTotal = parseFloat(
      screen.getByText(/Total Amount:/i).textContent?.replace(/[^0-9.]/g, "") ||
        "0",
    );

    // Tax and fees are applied to the discounted subtotal, so the total drops by
    // roughly the full 10%.
    expect(newTotal).toBeLessThan(initialTotal);
    expect(Math.abs(initialTotal - newTotal - initialTotal * 0.1)).toBeLessThan(
      1,
    );
  });

  it("toggles the agreed to terms checkbox", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    const termsCheckbox = screen.getByLabelText(
      /I confirm all the information/i,
    );
    fireEvent.click(termsCheckbox);

    expect(mockSetAgreedToTerms).toHaveBeenCalledWith(true);
  });
});
