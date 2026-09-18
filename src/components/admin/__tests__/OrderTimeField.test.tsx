import "@testing-library/jest-dom";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderTimeField } from "../OrderTimeField";
import type { TimePreference } from "@/lib/specific-time-charge";

function Harness({
  initial,
  initialPreference,
  onChange = jest.fn(),
  onPreferenceChange = jest.fn(),
}: {
  initial: string;
  initialPreference?: TimePreference;
  onChange?: (v: string) => void;
  onPreferenceChange?: (p: TimePreference) => void;
}) {
  const [value, setValue] = useState(initial);
  const [preference, setPreference] = useState(initialPreference);
  return (
    <OrderTimeField
      id="t"
      label="Rental Time"
      value={value}
      preference={preference}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
      onPreferenceChange={(p) => {
        onPreferenceChange(p);
        setPreference(p);
      }}
    />
  );
}

describe("OrderTimeField", () => {
  it("always requires a clock time", () => {
    render(<Harness initial="14:00" initialPreference="flexible" />);

    const input = screen.getByLabelText("Rental Time");
    expect(input).toHaveValue("14:00");
    expect(input).toBeRequired();
    expect(input).toBeEnabled();
    expect(screen.getByRole("radio", { name: /flexible/i })).toBeChecked();
  });

  it("shows a stored specific preference", () => {
    render(<Harness initial="14:00" initialPreference="specific" />);

    expect(screen.getByRole("radio", { name: /specific/i })).toBeChecked();
  });

  it("shows a legacy ANY as flexible with an empty, required time", () => {
    render(<Harness initial="ANY" />);

    expect(screen.getByRole("radio", { name: /flexible/i })).toBeChecked();
    const input = screen.getByLabelText("Rental Time");
    expect(input).toHaveValue("");
    expect(input).toBeRequired();
  });

  it("shows a legacy clock time with no preference as specific, as it was priced", () => {
    render(<Harness initial="09:00" />);

    expect(screen.getByRole("radio", { name: /specific/i })).toBeChecked();
  });

  it("writes the preference without touching the time", () => {
    const onChange = jest.fn();
    const onPreferenceChange = jest.fn();
    render(
      <Harness
        initial="14:00"
        initialPreference="flexible"
        onChange={onChange}
        onPreferenceChange={onPreferenceChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /specific/i }));
    expect(onPreferenceChange).toHaveBeenLastCalledWith("specific");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Rental Time")).toHaveValue("14:00");
  });
});
