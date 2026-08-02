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

  // The review step used to call computeOrderTotal(formData) with no settings
  // argument, so it displayed hardcoded defaults while the sidebar, the email
  // and payment.amount all used the admin overrides.
  it("applies admin pricing overrides to the displayed total", () => {
    const readTotal = () =>
      parseFloat(
        screen
          .getByText(/Total Amount:/i)
          .textContent?.replace(/[^0-9.]/g, "") || "0",
      );

    const { rerender } = render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );
    const defaultTotal = readTotal();

    rerender(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        settings={{ fees: { deliveryFee: 200 } }}
      />,
    );

    expect(readTotal()).toBeGreaterThan(defaultTotal);
  });

  it("labels the tax rate from settings rather than hardcoding it", () => {
    render(
      <ReviewStep
        formData={mockFormData}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
        settings={{ fees: { salesTaxRate: 0.1 } }}
      />,
    );

    expect(screen.getByText(/Sales Tax \(10%\)/i)).toBeInTheDocument();
  });

  it("charges flat-priced extras once, not per rental day", () => {
    render(
      <ReviewStep
        formData={{
          ...mockFormData,
          rentalDate: "2025-04-15",
          returnDate: "2025-04-18",
          selectedExtras: [
            {
              id: "mixer-margarita",
              name: "Margarita Mixer — Extra Mixer",
              description: "",
              price: 19.95,
              quantity: 1,
              pricingType: "flat",
            },
          ],
        }}
        onInputChange={jest.fn()}
        error={null}
        agreedToTerms={false}
        setAgreedToTerms={mockSetAgreedToTerms}
      />,
    );

    // The line item must not read "$19.95/day × 3 days = $59.85" while the
    // extras total correctly says $19.95.
    expect(screen.queryByText(/59\.85/)).toBeNull();
    expect(screen.getByText(/Extras Total: \$19\.95/i)).toBeInTheDocument();
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
