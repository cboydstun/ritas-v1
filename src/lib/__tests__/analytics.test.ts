import {
  trackEvent,
  pushDataLayer,
  pushDataLayerThen,
  DATALAYER_CALLBACK_TIMEOUT_MS,
} from "../analytics";

describe("trackEvent", () => {
  afterEach(() => {
    delete window.gtag;
  });

  it("forwards the event name and params to gtag", () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    trackEvent("purchase", { transaction_id: "abc123", value: 249.5 });

    expect(gtag).toHaveBeenCalledWith("event", "purchase", {
      transaction_id: "abc123",
      value: 249.5,
    });
  });

  it("sends an event with no params", () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    trackEvent("begin_checkout");

    expect(gtag).toHaveBeenCalledWith("event", "begin_checkout", undefined);
  });

  // gtag is absent in development, behind an ad blocker, and for the moment
  // before the script loads. Analytics must never be able to break a booking.
  it("is a no-op when gtag is not installed", () => {
    expect(window.gtag).toBeUndefined();
    expect(() =>
      trackEvent("generate_lead", { lead_type: "contact" }),
    ).not.toThrow();
  });
});

describe("pushDataLayer", () => {
  afterEach(() => {
    delete window.dataLayer;
  });

  it("pushes the event name alongside its params", () => {
    window.dataLayer = [];

    pushDataLayer("purchase_complete", {
      transaction_id: "bk_123",
      value: 249.5,
      currency: "USD",
    });

    expect(window.dataLayer).toEqual([
      {
        event: "purchase_complete",
        transaction_id: "bk_123",
        value: 249.5,
        currency: "USD",
      },
    ]);
  });

  it("pushes an event with no params", () => {
    window.dataLayer = [];

    pushDataLayer("lead_submitted");

    expect(window.dataLayer).toEqual([{ event: "lead_submitted" }]);
  });

  // The GTM bootstrap is production-gated, so the array is absent in
  // development and behind an ad blocker. This push sits inside the booking
  // submit handler's try block — a throw here would be caught and reported to
  // the customer as a failed booking.
  it("is a no-op when the dataLayer does not exist", () => {
    expect(window.dataLayer).toBeUndefined();
    expect(() =>
      pushDataLayer("purchase_complete", { value: 10 }),
    ).not.toThrow();
  });
});

// Every one of these guards the same failure: a Google Ads conversion tag is a
// request the container issues itself, so the redirect in `ReviewStep` has to
// wait for it — and has to happen anyway when it never fires.
describe("pushDataLayerThen", () => {
  afterEach(() => {
    delete window.dataLayer;
    jest.useRealTimers();
  });

  it("pushes eventCallback and eventTimeout alongside the params", () => {
    window.dataLayer = [];

    pushDataLayerThen("purchase_complete", { value: 249.5 }, jest.fn());

    expect(window.dataLayer).toHaveLength(1);
    const pushed = window.dataLayer[0] as Record<string, unknown>;
    expect(pushed.event).toBe("purchase_complete");
    expect(pushed.value).toBe(249.5);
    expect(pushed.eventTimeout).toBe(DATALAYER_CALLBACK_TIMEOUT_MS);
    expect(typeof pushed.eventCallback).toBe("function");
  });

  it("runs the callback once GTM reports the tags have fired", () => {
    window.dataLayer = [];
    const done = jest.fn();

    pushDataLayerThen("purchase_complete", { value: 1 }, done);
    expect(done).not.toHaveBeenCalled();

    const pushed = window.dataLayer[0] as {
      eventCallback: (containerId?: string) => void;
    };
    pushed.eventCallback("GTM-NRQ9HDL9");

    expect(done).toHaveBeenCalledTimes(1);
  });

  // An ad blocker, a consent denial suppressing every tag on the push, or a
  // container that simply never answers. The booking is already written at
  // this point, so the customer must not be stranded on the review step.
  it("runs the callback on timeout when GTM never answers", () => {
    jest.useFakeTimers();
    window.dataLayer = [];
    const done = jest.fn();

    pushDataLayerThen("purchase_complete", { value: 1 }, done);
    expect(done).not.toHaveBeenCalled();

    jest.advanceTimersByTime(DATALAYER_CALLBACK_TIMEOUT_MS);

    expect(done).toHaveBeenCalledTimes(1);
  });

  it("runs the callback exactly once when both the tags and the timeout fire", () => {
    jest.useFakeTimers();
    window.dataLayer = [];
    const done = jest.fn();

    pushDataLayerThen("purchase_complete", { value: 1 }, done);
    const pushed = window.dataLayer[0] as { eventCallback: () => void };
    pushed.eventCallback();
    jest.advanceTimersByTime(DATALAYER_CALLBACK_TIMEOUT_MS * 2);

    expect(done).toHaveBeenCalledTimes(1);
  });

  // The GTM bootstrap is production-gated, so there is no array at all in
  // development. Waiting out the timeout there would add two seconds to every
  // local booking for nothing.
  it("runs the callback synchronously when the dataLayer does not exist", () => {
    expect(window.dataLayer).toBeUndefined();
    const done = jest.fn();

    pushDataLayerThen("purchase_complete", { value: 1 }, done);

    expect(done).toHaveBeenCalledTimes(1);
  });
});
