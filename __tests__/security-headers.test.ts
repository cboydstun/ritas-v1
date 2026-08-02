import { securityHeaders } from "../next.config";

/**
 * The CSP is hand-written, so any origin it fails to list is dropped by the
 * browser with no server-side signal. That already cost us GA4: connect-src
 * named the exact host www.google-analytics.com, which does not match the
 * regional endpoint region1.google-analytics.com that GA4 actually beacons
 * to, so every hit was blocked and the property reported "data collection
 * isn't active" for weeks.
 *
 * These tests assert the policy against the concrete URLs the third-party
 * tags request, rather than against substrings, so an exact-host regression
 * fails here instead of silently in production.
 */

function cspValue(): string {
  const header = securityHeaders.filter(
    (h) => h.key === "Content-Security-Policy",
  );
  expect(header).toHaveLength(1);
  return header[0].value;
}

function sourcesFor(directive: string): string[] {
  const found = cspValue()
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .find((part) => part === directive || part.startsWith(`${directive} `));

  if (!found) {
    throw new Error(`CSP has no ${directive} directive`);
  }
  return found.split(/\s+/).slice(1);
}

/** Approximates CSP host-source matching for a single https URL. */
function permits(directive: string, url: string): boolean {
  const { protocol, hostname } = new URL(url);
  if (protocol !== "https:") return false;

  return sourcesFor(directive).some((source) => {
    if (!source.startsWith("https://")) return false;
    const pattern = source.slice("https://".length).replace(/\/.*$/, "");

    if (pattern.startsWith("*.")) {
      // CSP wildcards match subdomains only, never the bare registrable domain.
      const suffix = pattern.slice(1);
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return hostname === pattern;
  });
}

describe("Content-Security-Policy", () => {
  it("is declared exactly once", () => {
    expect(
      securityHeaders.filter((h) => h.key === "Content-Security-Policy"),
    ).toHaveLength(1);
  });

  describe("GA4", () => {
    // gtag picks its collect host at runtime from config Google controls, so
    // every host it is known to use must be permitted. analytics.google.com
    // is the bare registrable domain — a *.analytics.google.com wildcard does
    // NOT cover it, which is the regression that killed collection outright.
    it.each([
      "https://analytics.google.com/g/collect",
      "https://region1.analytics.google.com/g/collect",
      "https://region1.google-analytics.com/g/collect",
      "https://www.google-analytics.com/g/collect",
    ])("allows a beacon to %s", (url) => {
      expect(permits("connect-src", url)).toBe(true);
    });

    it("allows the gtag.js loader", () => {
      expect(
        permits("script-src", "https://www.googletagmanager.com/gtag/js"),
      ).toBe(true);
    });

    it("allows the GTM noscript iframe", () => {
      expect(
        permits("frame-src", "https://www.googletagmanager.com/ns.html"),
      ).toBe(true);
    });

    it("keeps 'unsafe-inline', which the gtag bootstrap still needs", () => {
      expect(sourcesFor("script-src")).toContain("'unsafe-inline'");
    });
  });

  describe("Google Ads conversions and Google Signals", () => {
    it("allows conversion beacons", () => {
      expect(
        permits("connect-src", "https://stats.g.doubleclick.net/g/collect"),
      ).toBe(true);
    });

    it("allows the remarketing pixel", () => {
      expect(
        permits(
          "img-src",
          "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/16908257875/",
        ),
      ).toBe(true);
    });

    it("allows the conversion linker frame", () => {
      expect(permits("frame-src", "https://td.doubleclick.net/td/ga/rul")).toBe(
        true,
      );
    });

    it("allows googleadservices", () => {
      expect(
        permits("script-src", "https://www.googleadservices.com/pagead/conversion.js"),
      ).toBe(true);
    });

    // Injected by the GTM container, never by our own code, so a repo grep
    // gives no warning that this origin is load-bearing.
    it("allows the call-tracking (WCM) loader", () => {
      expect(permits("script-src", "https://www.gstatic.com/wcm/loader.js")).toBe(
        true,
      );
    });

    it("allows conversion beacons to google.com", () => {
      expect(
        permits(
          "connect-src",
          "https://www.google.com/pagead/1p-conversion/16908257875/",
        ),
      ).toBe(true);
    });
  });

  it("still refuses an unrelated third-party origin", () => {
    expect(permits("connect-src", "https://evil.example.com/collect")).toBe(
      false,
    );
  });

  it("models the wildcard rule that caused the outage", () => {
    // Guards the matcher itself: if this ever passes, `permits` has stopped
    // modelling CSP and the assertions above are worthless.
    expect(
      permits("connect-src", "https://notanalytics.google.com.evil.test/x"),
    ).toBe(false);
  });
});
