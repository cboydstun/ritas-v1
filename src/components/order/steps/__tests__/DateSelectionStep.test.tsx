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
    rentalTime: "ANY",
    returnDate: "2099-06-02",
    returnTime: "ANY",
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
  it("starts both legs on the free flexible option with no time dropdown", () => {
    render(<Harness />);

    expect(
      within(deliveryLeg()).getByRole("radio", { name: /any time/i }),
    ).toBeChecked();
    expect(
      within(pickupLeg()).getByRole("radio", { name: /any time/i }),
    ).toBeChecked();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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

  it("choosing a specific time writes a clock time and shows the dropdown for that leg only", () => {
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(
      within(deliveryLeg()).getByRole("radio", { name: /specific time/i }),
    );

    expect(onChange).toHaveBeenLastCalledWith("rentalTime", "08:00");
    const select = within(deliveryLeg()).getByRole("combobox");
    expect(select).toHaveValue("08:00");
    // No "any time" choice inside the dropdown — that is the other card.
    expect(
      within(select).queryByRole("option", { name: /any/i }),
    ).not.toBeInTheDocument();
    expect(within(pickupLeg()).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("changing the dropdown writes the chosen time", () => {
    const onChange = jest.fn();
    render(
      <Harness
        onChange={onChange}
        initial={baseForm({ returnTime: "10:00" })}
      />,
    );

    fireEvent.change(within(pickupLeg()).getByRole("combobox"), {
      target: { value: "15:00" },
    });

    expect(onChange).toHaveBeenLastCalledWith("returnTime", "15:00");
  });

  it("choosing any time again writes ANY and hides the dropdown", () => {
    const onChange = jest.fn();
    render(
      <Harness
        onChange={onChange}
        initial={baseForm({ rentalTime: "11:00" })}
      />,
    );

    fireEvent.click(
      within(deliveryLeg()).getByRole("radio", { name: /any time/i }),
    );

    expect(onChange).toHaveBeenLastCalledWith("rentalTime", "ANY");
    expect(
      within(deliveryLeg()).queryByRole("combobox"),
    ).not.toBeInTheDocument();
  });

  it("totals the pinned legs in the summary", () => {
    render(
      <Harness
        initial={baseForm({ rentalTime: "11:00", returnTime: "15:00" })}
        specificDeliveryTimeFee={25}
        specificPickupTimeFee={25}
      />,
    );

    expect(screen.getByText(/specific-time fee: \+\$50/i)).toBeInTheDocument();
    expect(screen.getByText(/at 11:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/at 3:00 PM/)).toBeInTheDocument();
  });

  it("shows no fee line when both legs are flexible", () => {
    render(<Harness />);

    expect(screen.queryByText(/specific-time fee/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/at any time/i)).toHaveLength(2);
  });

  it("hides the time legs until a delivery date is picked", () => {
    render(<Harness initial={baseForm({ rentalDate: "", returnDate: "" })} />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
