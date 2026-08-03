import { trackEvent } from "../analytics";

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
