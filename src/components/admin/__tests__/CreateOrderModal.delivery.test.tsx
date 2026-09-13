/**
 * The office quotes from this modal, so its delivery figure has to be the one
 * `POST /api/admin/orders` will store.
 *
 * `computeOrderTotal` resolves the distance surcharge from
 * `formData.customer.address.zipCode`. The preview used to call it without a
 * `customer` at all, so it quoted the delivery and setup fee alone — $20 —
 * while the route, which does pass the customer, stored $20 + the ZIP's own
 * surcharge. Nothing else would have caught it: the route has no price guard
 * to compare a quote against, because the quote never reached it.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateOrderModal from "../CreateOrderModal";

const SETTINGS = {
  fees: {
    salesTaxRate: 0.0825,
    processingFeeRate: 0.03,
    deliveryFee: 20,
    minOrderAmount: 0,
  },
  deliveryZones: {
    baseFee: 20,
    // 78201 is central and carries no surcharge; 78052 Lytle is the far end of
    // the service area. A preview that ignores the ZIP cannot tell them apart.
    customFees: { "78201": 0, "78052": 100 },
    insideZips: ["78201"],
    outsideZips: ["78052"],
    tierMinimums: { free: 0, low: 0, standard: 0, high: 0, premium: 0 },
  },
};

function mockSettings() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => SETTINGS,
  }) as unknown as typeof fetch;
}

/** The rendered "Delivery Fee:" figure, as a number. */
function deliveryFeeShown(): number {
  const label = screen.getByText("Delivery Fee:");
  const amount = label.nextElementSibling?.textContent ?? "";
  return Number(amount.replace(/[^0-9.]/g, ""));
}

/** The price breakdown only renders once both dates are set. */
async function fillOrder(zip: string) {
  fireEvent.change(screen.getByLabelText(/Rental Date/i), {
    target: { value: "2026-10-02" },
  });
  fireEvent.change(screen.getByLabelText(/Return Date/i), {
    target: { value: "2026-10-03" },
  });
  fireEvent.change(screen.getByLabelText(/ZIP Code/i), {
    target: { value: zip },
  });
  await waitFor(() => expect(screen.getByText("Delivery Fee:")).toBeTruthy());
}

describe("CreateOrderModal delivery quote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings();
  });

  it("quotes the delivery and setup fee alone for a ZIP with no surcharge", async () => {
    render(<CreateOrderModal onClose={() => {}} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await fillOrder("78201");
    await waitFor(() => expect(deliveryFeeShown()).toBe(20));
  });

  it("adds the ZIP's own distance surcharge on top", async () => {
    render(<CreateOrderModal onClose={() => {}} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await fillOrder("78052");
    // $20 delivery and setup + $100 to drive to Lytle. Quoting $20 here is the
    // bug this test exists for.
    await waitFor(() => expect(deliveryFeeShown()).toBe(120));
  });
});
