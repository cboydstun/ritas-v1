import { trackEvent, pushDataLayer } from "../analytics";

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
