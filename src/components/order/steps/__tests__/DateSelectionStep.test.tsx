import "@testing-library/jest-dom";
import { ChangeEvent, useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import DateSelectionStep from "../DateSelectionStep";
import type { OrderFormData } from "../../types";

function baseForm(overrides: Partial<OrderFormData> = {}): OrderFormData {
  return {
    machineType: "single",
    capacity: 15,
    selectedMixers: [],
    selectedExtras: [],
    price: 0,
    rentalDate: "2099-06-01",
    rentalTime: "",
    rentalTimePreference: "flexible",
    returnDate: "2099-06-02",
    returnTime: "",
    returnTimePreference: "flexible",
    customer: {
      name: "",
      email: "",
      phone: "",
      address: { street: "", city: "", state: "", zipCode: "" },
    },
    notes: "",
    isServiceDiscount: false,
    ...overrides,
  };
}

/** A stateful parent, so the step behaves as it does inside OrderForm. */
function Harness({
  initial = baseForm(),
  onChange,
  ...props
}: {
  initial?: OrderFormData;
  onChange?: (name: string, value: string) => void;
  specificDeliveryTimeFee?: number;
  specificPickupTimeFee?: number;
}) {
  const [formData, setFormData] = useState(initial);
  const handle = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    onChange?.(name, value);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  return (
    <DateSelectionStep
      formData={formData}
      onInputChange={handle}
      error={null}
      deliveryWindowStartHour={8}
      deliveryWindowEndHour={18}
      {...props}
    />
  );
}

const deliveryLeg = () => screen.getByRole("group", { name: /delivery time/i });
const pickupLeg = () => screen.getByRole("group", { name: /pickup time/i });

describe("DateSelectionStep time legs", () => {
  it("asks for a preferred time on both legs, with no time chosen yet", () => {
    render(<Harness />);

    for (const leg of [deliveryLeg(), pickupLeg()]) {
      const select = within(leg).getByRole("combobox");
      expect(select).toHaveValue("");
      expect(select).toBeRequired();
    }
  });

  it("offers no 'any time' choice anywhere", () => {
    render(<Harness />);

    expect(
      screen.queryByRole("radio", { name: /any time/i }),
    ).not.toBeInTheDocument();
    for (const leg of [deliveryLeg(), pickupLeg()]) {
      expect(
        within(within(leg).getByRole("combobox")).queryByRole("option", {
          name: /any/i,
        }),
      ).not.toBeInTheDocument();
    }
  });

  it("starts both legs on the free flexible option", () => {
    render(<Harness />);

    expect(
      within(deliveryLeg()).getByRole("radio", { name: /flexible.*free/i }),
    ).toBeChecked();
    expect(
      within(pickupLeg()).getByRole("radio", { name: /flexible.*free/i }),
    ).toBeChecked();
  });

  it("explains flexible as at-or-before delivery and at-or-after pickup", () => {
    render(
      <Harness
        initial={baseForm({ rentalTime: "14:00", returnTime: "18:00" })}
      />,
    );

    expect(
      within(deliveryLeg()).getByText(/at or before 2:00 PM/),
    ).toBeInTheDocument();
    expect(
      within(pickupLeg()).getByText(/at or after 6:00 PM/),
    ).toBeInTheDocument();
  });

  it("labels the specific option with the fee from props", () => {
    render(<Harness specificDeliveryTimeFee={25} specificPickupTimeFee={15} />);

    expect(
      within(deliveryLeg()).getByRole("radio", {
        name: /specific time.*\+\$25/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(pickupLeg()).getByRole("radio", {
        name: /specific time.*\+\$15/i,
      }),
    ).toBeInTheDocument();
  });

  it("says no charge when a leg's fee is zero", () => {
    render(<Harness specificDeliveryTimeFee={0} specificPickupTimeFee={25} />);

    expect(
      within(deliveryLeg()).getByRole("radio", {
        name: /specific time.*no charge/i,
      }),
    ).toBeInTheDocument();
  });

  it("choosing the dropdown writes the time only", () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.change(within(pickupLeg()).getByRole("combobox"), {
      target: { value: "15:00" },
    });

    expect(onChange).toHaveBeenLastCalledWith("returnTime", "15:00");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("choosing a card writes that leg's preference and keeps the time", () => {
    const onChange = jest.fn();
    render(
      <Harness
        onChange={onChange}
        initial={baseForm({ rentalTime: "11:00" })}
      />,
    );

    fireEvent.click(
      within(deliveryLeg()).getByRole("radio", { name: /specific time/i }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      "rentalTimePreference",
      "specific",
    );
    expect(within(deliveryLeg()).getByRole("combobox")).toHaveValue("11:00");

    fireEvent.click(
      within(deliveryLeg()).getByRole("radio", { name: /flexible/i }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      "rentalTimePreference",
      "flexible",
    );
  });

  it("totals the specific legs in the summary", () => {
    render(
      <Harness
        initial={baseForm({
          rentalTime: "11:00",
          rentalTimePreference: "specific",
          returnTime: "15:00",
          returnTimePreference: "specific",
        })}
        specificDeliveryTimeFee={25}
        specificPickupTimeFee={25}
      />,
    );

    expect(screen.getByText(/specific-time fee: \+\$50/i)).toBeInTheDocument();
    expect(screen.getByText(/at 11:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/at 3:00 PM/)).toBeInTheDocument();
  });

  it("shows no fee line when both legs are flexible, and says by/from", () => {
    render(
      <Harness
        initial={baseForm({ rentalTime: "11:00", returnTime: "15:00" })}
      />,
    );

    expect(screen.queryByText(/specific-time fee/i)).not.toBeInTheDocument();
    expect(screen.getByText(/by 11:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/from 3:00 PM/)).toBeInTheDocument();
  });

  it("hides the time legs until a delivery date is picked", () => {
    render(<Harness initial={baseForm({ rentalDate: "", returnDate: "" })} />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
