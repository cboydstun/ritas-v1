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

  // The wizard never changes the URL, so GA4 has no funnel without these.
  describe("GA4 events", () => {
    let gtag: jest.Mock;

    beforeEach(() => {
      gtag = jest.fn();
      window.gtag = gtag;
    });

    afterEach(() => {
      delete window.gtag;
    });

    const eventsNamed = (name: string) =>
      gtag.mock.calls.filter((call) => call[0] === "event" && call[1] === name);

    it("emits order_step with a 1-based index and label", async () => {
      await act(async () => {
        render(
          <OrderFormTracker currentStep="details" formData={makeFormData()} />,
        );
      });

      expect(eventsNamed("order_step")[0][2]).toEqual({
        step_id: "details",
        step_index: 3,
        step_name: "Your Details",
      });
    });

    it("emits order_step again on a step change", async () => {
      const formData = makeFormData();
      let rerender: ReturnType<typeof render>["rerender"];

      await act(async () => {
        ({ rerender } = render(
          <OrderFormTracker currentStep="date" formData={formData} />,
        ));
      });

      await act(async () => {
        rerender(
          <OrderFormTracker currentStep="machine" formData={formData} />,
        );
      });

      expect(eventsNamed("order_step")).toHaveLength(2);
      expect(eventsNamed("order_step")[1][2].step_id).toBe("machine");
    });

    it("does not re-emit when the step prop is unchanged", async () => {
      const formData = makeFormData();
      let rerender: ReturnType<typeof render>["rerender"];

      await act(async () => {
        ({ rerender } = render(
          <OrderFormTracker currentStep="date" formData={formData} />,
        ));
      });

      await act(async () => {
        rerender(<OrderFormTracker currentStep="date" formData={formData} />);
      });

      expect(eventsNamed("order_step")).toHaveLength(1);
    });

    it("emits begin_checkout with the running total on the review step", async () => {
      await act(async () => {
        render(
          <OrderFormTracker currentStep="review" formData={makeFormData()} />,
        );
      });

      // The value comes from `computeOrderTotal`, not from `formData.price`
      // — the same source `purchase` uses, so the two events cannot report
      // different carts. `makeFormData` sets `price: 100`, which is why this
      // is not that number.
      expect(eventsNamed("begin_checkout")[0][2]).toEqual({
        value: 189.49,
        currency: "USD",
        machine_type: "double",
        items: [
          {
            item_id: "machine-double",
            item_name: "double margarita machine",
            item_category: "machine",
            price: 149.95,
            quantity: 1,
          },
        ],
      });
    });

    it.each<OrderStep>(["date", "machine", "details", "extras"])(
      "does not emit begin_checkout on the %s step",
      async (step) => {
        await act(async () => {
          render(
            <OrderFormTracker currentStep={step} formData={makeFormData()} />,
          );
        });

        expect(eventsNamed("begin_checkout")).toHaveLength(0);
      },
    );

    // The fingerprint POST awaits a lazy import and can fail; the funnel must
    // not be downstream of either.
    it("still emits when the fingerprint POST fails", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        render(
          <OrderFormTracker currentStep="date" formData={makeFormData()} />,
        );
      });

      expect(eventsNamed("order_step")).toHaveLength(1);
    });
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
