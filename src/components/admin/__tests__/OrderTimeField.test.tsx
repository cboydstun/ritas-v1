import "@testing-library/jest-dom";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderTimeField } from "../OrderTimeField";

function Harness({
  initial,
  onChange,
}: {
  initial: string;
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <OrderTimeField
      id="t"
      label="Rental Time"
      value={value}
      onChange={(v) => {
        onChange(v);
        setValue(v);
      }}
    />
  );
}

describe("OrderTimeField", () => {
  it("shows a stored ANY as ticked, with the time input disabled", () => {
    render(<Harness initial="ANY" onChange={jest.fn()} />);

    expect(screen.getByRole("checkbox", { name: /any time/i })).toBeChecked();
    expect(screen.getByLabelText("Rental Time")).toBeDisabled();
  });

  it("shows a clock time as pinned and required", () => {
    render(<Harness initial="14:00" onChange={jest.fn()} />);

    expect(
      screen.getByRole("checkbox", { name: /any time/i }),
    ).not.toBeChecked();
    const input = screen.getByLabelText("Rental Time");
    expect(input).toHaveValue("14:00");
    expect(input).toBeRequired();
  });

  it("ticking writes ANY; unticking clears the time for the admin to pick", () => {
    const onChange = jest.fn();
    render(<Harness initial="14:00" onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: /any time/i });

    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith("ANY");

    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Rental Time")).toBeEnabled();
    expect(screen.getByLabelText("Rental Time")).toBeRequired();
  });
});
