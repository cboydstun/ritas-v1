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
  const mockSetIsServiceDiscount = jest.fn();

  it("renders review details", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        setIsServiceDiscount={mockSetIsServiceDiscount}
      />,
    );

    expect(
      screen.getByText(/Review & Confirm Your Order/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Selected Machine/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing Details/i)).toBeInTheDocument();
  });

  it("applies service discount when checkbox is checked", () => {
    const { rerender } = render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        setIsServiceDiscount={mockSetIsServiceDiscount}
      />,
    );

    // Get the initial total amount
    const initialTotalText = screen.getByText(/Total Amount:/i).textContent;
    const initialTotal = parseFloat(
      initialTotalText?.replace(/[^0-9.]/g, "") || "0",
    );

    // Find and check the service discount checkbox
    const discountCheckbox = screen.getByLabelText(/I am a military member/i);
    fireEvent.click(discountCheckbox);

    // Verify the setIsServiceDiscount was called with true
    expect(mockSetIsServiceDiscount).toHaveBeenCalledWith(true);

    // Issue 3: discount is now driven by formData.isServiceDiscount (not a prop)
    rerender(
      <ReviewStep
        formData={{ ...mockFormData, isServiceDiscount: true }}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        setIsServiceDiscount={mockSetIsServiceDiscount}
      />,
    );

    // Verify the discount is displayed
    expect(screen.getByText(/Service Discount \(10%\):/i)).toBeInTheDocument();

    // Get the new total amount
    const newTotalText = screen.getByText(/Total Amount:/i).textContent;
    const newTotal = parseFloat(newTotalText?.replace(/[^0-9.]/g, "") || "0");

    // Verify the total amount is reduced
    expect(newTotal).toBeLessThan(initialTotal);

    // Calculate expected discount: 10% of subtotal; since tax/fees are also applied to
    // the discounted subtotal, the total difference is approximately 10% of the full total.
    const expectedDiscount = initialTotal * 0.1;
    const actualDiscount = initialTotal - newTotal;

    // Verify the discount amount is approximately correct (within $1)
    expect(Math.abs(actualDiscount - expectedDiscount)).toBeLessThan(1);
  });

  it("toggles the agreed to terms checkbox", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        setIsServiceDiscount={mockSetIsServiceDiscount}
      />,
    );

    const termsCheckbox = screen.getByLabelText(
      /I confirm all the information/i,
    );
    fireEvent.click(termsCheckbox);

    expect(mockSetAgreedToTerms).toHaveBeenCalledWith(true);
  });
});
