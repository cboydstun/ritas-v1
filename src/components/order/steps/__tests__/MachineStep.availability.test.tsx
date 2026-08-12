import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import MachineStep from "../MachineStep";
import { OrderFormData } from "@/components/order/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const formData = (overrides: Partial<OrderFormData> = {}): OrderFormData =>
  ({
    machineType: "double",
    capacity: 30,
    selectedMixers: [],
    selectedExtras: [],
    price: 0,
    rentalDate: "2026-09-01",
    rentalTime: "12:00",
    returnDate: "2026-09-02",
    returnTime: "12:00",
    customer: {
      name: "",
      email: "",
      phone: "",
      address: { street: "", city: "", state: "TX", zipCode: "" },
    },
    notes: "",
    isServiceDiscount: false,
    ...overrides,
  }) as OrderFormData;

/** Resolve `/api/v1/availability` per machine type. */
const mockAvailability = (
  byType: Record<string, boolean>,
  { defer = false }: { defer?: boolean } = {},
) => {
  const pending: (() => void)[] = [];
  global.fetch = jest.fn((url: string) => {
    const machineType = new URL(url, "http://localhost").searchParams.get(
      "machineType",
    )!;
    const respond = () =>
      Promise.resolve({
        ok: true,
        json: async () => ({ available: byType[machineType] ?? true }),
      });
    if (!defer) return respond();
    return new Promise((resolve) => {
      pending.push(() => resolve(respond()));
    });
  }) as unknown as typeof fetch;
  return { flush: () => pending.forEach((p) => p()) };
};

describe("MachineStep availability", () => {
  beforeEach(() => jest.clearAllMocks());

  it("checks all three machine types once for a date range", async () => {
    mockAvailability({ single: true, double: true, triple: true });

    render(
      <MachineStep
        formData={formData()}
        onInputChange={jest.fn()}
        error={null}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });

  // Every card used to count as selectable while its check was still in
  // flight, so a customer could pick — and advance on — a machine the server
  // was about to refuse.
  it("does not select a machine while its check is still in flight", async () => {
    const { flush } = mockAvailability(
      { single: true, double: true, triple: true },
      { defer: true },
    );
    const onInputChange = jest.fn();

    render(
      <MachineStep
        formData={formData()}
        onInputChange={onInputChange}
        error={null}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(
      screen.getByRole("button", { name: /Select 45L Triple Tank Machine/i }),
    );
    expect(onInputChange).not.toHaveBeenCalled();

    flush();
    await waitFor(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /Select 45L Triple Tank Machine/i }),
      );
      expect(onInputChange).toHaveBeenCalled();
    });
  });

  it("reports the in-flight state to the parent so Next can be held", async () => {
    const { flush } = mockAvailability(
      { single: true, double: true, triple: true },
      { defer: true },
    );
    const onAvailabilityChecking = jest.fn();

    render(
      <MachineStep
        formData={formData()}
        onInputChange={jest.fn()}
        error={null}
        onAvailabilityChecking={onAvailabilityChecking}
      />,
    );

    await waitFor(() =>
      expect(onAvailabilityChecking).toHaveBeenCalledWith(true),
    );

    flush();
    await waitFor(() =>
      expect(onAvailabilityChecking).toHaveBeenLastCalledWith(false),
    );
  });

  it("refuses a machine type that came back fully booked", async () => {
    mockAvailability({ single: true, double: true, triple: false });
    const onInputChange = jest.fn();

    render(
      <MachineStep
        formData={formData({ machineType: "single", capacity: 15 })}
        onInputChange={onInputChange}
        error={null}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    onInputChange.mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: /Select 45L Triple Tank Machine/i }),
    );

    expect(onInputChange).not.toHaveBeenCalled();
  });

  // The fallback rewrites machine type, capacity, mixers and the price. It
  // used to do all of that with nothing shown to the customer.
  it("announces the auto-fallback when the chosen machine is unavailable", async () => {
    mockAvailability({ single: true, double: false, triple: true });

    render(
      <MachineStep
        formData={formData({ machineType: "double" })}
        onInputChange={jest.fn()}
        error={null}
      />,
    );

    const notice = await screen.findByText(
      /we switched you to the triple tank/i,
    );
    expect(notice.closest("[role='status']")).not.toBeNull();
  });

  it("does not re-request availability when only the machine type changes", async () => {
    mockAvailability({ single: true, double: true, triple: true });

    const { rerender } = render(
      <MachineStep
        formData={formData({ machineType: "double" })}
        onInputChange={jest.fn()}
        error={null}
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

    rerender(
      <MachineStep
        formData={formData({ machineType: "triple", capacity: 45 })}
        onInputChange={jest.fn()}
        error={null}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });

  it("does not fetch at all before a date range is chosen", async () => {
    mockAvailability({ single: true, double: true, triple: true });

    render(
      <MachineStep
        formData={formData({ rentalDate: "", returnDate: "" })}
        onInputChange={jest.fn()}
        error={null}
      />,
    );

    await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
  });
});
