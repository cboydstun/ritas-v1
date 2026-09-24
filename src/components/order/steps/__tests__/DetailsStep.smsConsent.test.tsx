import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import DetailsStep from "../DetailsStep";
import type { OrderFormData } from "../../types";

function form(
  customer: Partial<OrderFormData["customer"]> = {},
): OrderFormData {
  return {
    machineType: "single",
    capacity: 15,
    selectedMixers: [],
    selectedExtras: [],
    price: 0,
    rentalDate: "2099-06-01",
    rentalTime: "11:00",
    rentalTimePreference: "flexible",
    returnDate: "2099-06-02",
    returnTime: "11:00",
    returnTimePreference: "flexible",
    customer: {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "(210)-555-1234",
      address: { street: "", city: "", state: "TX", zipCode: "" },
      ...customer,
    },
    notes: "",
    isServiceDiscount: false,
  };
}

describe("the SMS opt-in on the details step", () => {
  it("is unticked by default and names SATX Bounce as the sender", () => {
    // The texts come from SATX Bounce's number, so that is who the customer
    // must be agreeing to hear from.
    render(
      <DetailsStep formData={form()} onInputChange={jest.fn()} error={null} />,
    );

    const box = screen.getByRole("checkbox", { name: /SMS text messages/ });
    expect(box).not.toBeChecked();
    expect(box.closest("div")).toHaveTextContent(
      /from SATX Bounce at \(210\)-555-1234/,
    );
    expect(box.closest("div")).toHaveTextContent(
      /Consent is not a condition of purchase/,
    );
  });

  it("reports the tick as a checkbox change on customer.smsConsent", () => {
    const onInputChange = jest.fn((e) => ({
      name: e.target.name,
      type: e.target.type,
      checked: e.target.checked,
    }));
    render(
      <DetailsStep
        formData={form()}
        onInputChange={onInputChange}
        error={null}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: /SMS text messages/ }),
    );

    expect(onInputChange.mock.results[0].value).toEqual({
      name: "customer.smsConsent",
      type: "checkbox",
      checked: true,
    });
  });

  it("shows a stored tick", () => {
    render(
      <DetailsStep
        formData={form({ smsConsent: true })}
        onInputChange={jest.fn()}
        error={null}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /SMS text messages/ }),
    ).toBeChecked();
  });
});
