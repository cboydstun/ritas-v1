import { CONSENT_STORAGE_KEY, getConsent, setConsent } from "../consent";

describe("consent", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.gtag;
  });

  it("reports no stored choice for a first-time visitor", () => {
    expect(getConsent()).toBeNull();
  });

  it("ignores a junk stored value rather than passing it to gtag", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "maybe");
    expect(getConsent()).toBeNull();
  });

  it("persists the choice under the shared storage key", () => {
    setConsent("denied");

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("denied");
    expect(getConsent()).toBe("denied");
  });

  it("pushes an opt-out to gtag across all four consent signals", () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    setConsent("denied");

    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
  });

  it("pushes an opt-in back to gtag", () => {
    const gtag = jest.fn();
    window.gtag = gtag;

    setConsent("granted");

    expect(gtag).toHaveBeenCalledWith(
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "granted" }),
    );
  });

  it("still records the choice when gtag has not loaded yet", () => {
    expect(() => setConsent("denied")).not.toThrow();
    expect(getConsent()).toBe("denied");
  });
});
