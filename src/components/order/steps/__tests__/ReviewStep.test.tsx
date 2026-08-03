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

  describe("on a successful booking", () => {
    interface PurchaseItem {
      item_id: string;
      item_name: string;
      item_category: string;
      price: number;
      quantity: number;
    }
    interface PurchaseParams {
      transaction_id: string;
      value: number;
      currency: string;
      items: PurchaseItem[];
    }

    // A hand-rolled recorder rather than jest.fn(): this suite imports jest
    // from @jest/globals, whose Mock type has no signature to infer here.
    let gtagCalls: unknown[][];

    const submit = async () => {
      render(
        <ReviewStep
          formData={{
            ...mockFormData,
            selectedExtras: [
              {
                id: "table-chairs",
                name: "Table & Chairs",
                description: "",
                price: 0,
                quantity: 2,
              },
            ],
          }}
          onInputChange={jest.fn()}
          error={null}
          agreedToTerms={true}
          setAgreedToTerms={mockSetAgreedToTerms}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /confirm booking/i }));
      // Let the fetch promise and the handler continuation settle.
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    const purchaseParams = () =>
      gtagCalls.find(
        (call) => call[0] === "event" && call[1] === "purchase",
      )?.[2] as PurchaseParams;

    beforeEach(() => {
      gtagCalls = [];
      window.gtag = (...args: unknown[]) => {
        gtagCalls.push(args);
      };

      global.fetch = (() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ bookingId: "bk_test_123" }),
        })) as unknown as typeof fetch;

      // jsdom's window.location cannot be stubbed and refuses the real
      // navigation at the end of the handler, logging "Not implemented".
      // Harmless: the redirect URL itself is covered by the buildSuccessUrl
      // tests in ../../__tests__/utils.test.ts.
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      delete window.gtag;
      jest.restoreAllMocks();
    });

    it("emits purchase with the booking id and server-side total", async () => {
      await submit();

      const params = purchaseParams();
      expect(params.transaction_id).toBe("bk_test_123");
      expect(params.currency).toBe("USD");
      expect(params.value).toBeGreaterThan(0);
    });

    it("itemises the machine and each extra", async () => {
      await submit();

      const items = purchaseParams().items;
      expect(items[0]).toMatchObject({
        item_id: "machine-single",
        item_category: "machine",
      });
      expect(items[1]).toMatchObject({
        item_id: "table-chairs",
        item_category: "extra",
        quantity: 2,
      });
    });

    // Extras prices are catalog-owned; anything on the item itself may have
    // come from a tampered draft in localStorage.
    it("prices extras from the catalog, not from the submitted item", async () => {
      await submit();

      const extra = purchaseParams().items[1];
      expect(extra.price).toBeGreaterThan(0);
      expect(extra.item_name).not.toBe("table-chairs");
    });
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
