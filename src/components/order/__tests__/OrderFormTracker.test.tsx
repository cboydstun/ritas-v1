import { render } from "@testing-library/react";
import { act } from "react";
import OrderFormTracker from "../OrderFormTracker";
import { OrderStep, OrderFormData } from "../types";

// Mock thumbmarkjs
jest.mock("@thumbmarkjs/thumbmarkjs", () => ({
  getFingerprint: jest.fn().mockResolvedValue("test-fingerprint-hash"),
}));

// Minimal valid form data
const makeFormData = (): OrderFormData => ({
  machineType: "double",
  capacity: 30,
  selectedMixers: [],
  selectedExtras: [],
  price: 100,
  rentalDate: "",
  rentalTime: "ANY",
  returnDate: "",
  returnTime: "ANY",
  customer: {
    name: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "TX", zipCode: "" },
  },
  notes: "",
  isServiceDiscount: false,
});

const FINGERPRINT_ENDPOINT = "/api/v1/analytics/fingerprint";

function mockFetch() {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ success: true }),
  });
}

describe("OrderFormTracker", () => {
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = mockFetch();
    global.fetch = fetchSpy;
    jest.clearAllMocks();
  });

  it("fires fetch on initial render with the starting step path", async () => {
    await act(async () => {
      render(<OrderFormTracker currentStep="date" formData={makeFormData()} />);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.page).toBe("/order/date");
  });

  it.each<OrderStep>(["date", "machine", "details", "extras", "review"])(
    'sends page path "/order/%s" for step "%s"',
    async (step) => {
      await act(async () => {
        render(
          <OrderFormTracker currentStep={step} formData={makeFormData()} />,
        );
      });

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.page).toBe(`/order/${step}`);
    },
  );

  it("does NOT fire fetch again when step prop does not change", async () => {
    const formData = makeFormData();
    let rerender: ReturnType<typeof render>["rerender"];

    await act(async () => {
      ({ rerender } = render(
        <OrderFormTracker currentStep="date" formData={formData} />,
      ));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(<OrderFormTracker currentStep="date" formData={formData} />);
    });

    // Still only one call — step hasn't changed
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fires fetch again when step changes", async () => {
    const formData = makeFormData();
    let rerender: ReturnType<typeof render>["rerender"];

    await act(async () => {
      ({ rerender } = render(
        <OrderFormTracker currentStep="date" formData={formData} />,
      ));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(<OrderFormTracker currentStep="machine" formData={formData} />);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(secondBody.page).toBe("/order/machine");
  });

  it("sends POST to the fingerprint endpoint", async () => {
    await act(async () => {
      render(<OrderFormTracker currentStep="date" formData={makeFormData()} />);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      FINGERPRINT_ENDPOINT,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("includes fingerprintHash in the request body", async () => {
    await act(async () => {
      render(<OrderFormTracker currentStep="date" formData={makeFormData()} />);
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.fingerprintHash).toBe("test-fingerprint-hash");
  });

  it("does not render any visible DOM output", async () => {
    let container: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <OrderFormTracker currentStep="date" formData={makeFormData()} />,
      ));
    });
    expect(container!.firstChild).toBeNull();
  });
});
