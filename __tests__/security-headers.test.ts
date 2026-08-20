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

    // fmt=4 makes this endpoint return JavaScript, injected as a <script>;
    // the same URL is also requested as a pixel, so it needs both directives.
    it("allows the remarketing tag loaded as a script", () => {
      expect(
        permits(
          "script-src",
          "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/16908257875/?fmt=4",
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
        permits(
          "script-src",
          "https://www.googleadservices.com/pagead/conversion.js",
        ),
      ).toBe(true);
    });

    // Injected by the GTM container, never by our own code, so a repo grep
    // gives no warning that this origin is load-bearing.
    it("allows the call-tracking (WCM) loader", () => {
      expect(
        permits("script-src", "https://www.gstatic.com/wcm/loader.js"),
      ).toBe(true);
    });

    it("allows conversion beacons to google.com", () => {
      expect(
        permits(
          "connect-src",
          "https://www.google.com/pagead/1p-conversion/16908257875/",
        ),
      ).toBe(true);
    });

    // Search-only campaigns never touch this host, which is why it went
    // unlisted. The first Display, remarketing or Performance Max campaign
    // does, and a refused tag reports nothing anywhere — the campaign simply
    // measures zero.
    it("allows the Display/PMax tag to load", () => {
      expect(
        permits(
          "script-src",
          "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
        ),
      ).toBe(true);
      expect(
        permits(
          "img-src",
          "https://pagead2.googlesyndication.com/pagead/1p-user-list/",
        ),
      ).toBe(true);
    });

    it("allows the Display/PMax frame", () => {
      expect(
        permits("frame-src", "https://tpc.googlesyndication.com/sadbundle/"),
      ).toBe(true);
    });

    // Ads has already moved conversion.js between www. and pagead. once.
    it("allows googleadservices on a subdomain other than www", () => {
      expect(
        permits(
          "script-src",
          "https://pagead.googleadservices.com/pagead/conversion.js",
        ),
      ).toBe(true);
    });

    // A *.googletagmanager.com wildcard does not match the registrable domain
    // itself — the same trap that took GA4 collection down in July.
    it("allows the bare googletagmanager.com host", () => {
      expect(permits("script-src", "https://googletagmanager.com/gtm.js")).toBe(
        true,
      );
    });
  });

  // The July outage was one host present in some directives and missing from
  // another. Rather than wait to discover which directive Google needs next,
  // require every analytics/ads origin in all four fetch directives that can
  // plausibly request it.
  describe("directive symmetry", () => {
    const origins = [
      "https://analytics.google.com/x",
      "https://region1.analytics.google.com/x",
      "https://google-analytics.com/x",
      "https://region1.google-analytics.com/x",
      "https://www.googletagmanager.com/x",
      "https://www.google.com/x",
      "https://www.googleadservices.com/x",
      "https://www.gstatic.com/x",
      "https://googleads.g.doubleclick.net/x",
      "https://doubleclick.net/x",
      "https://googletagmanager.com/x",
      "https://pagead.googleadservices.com/x",
      "https://googleadservices.com/x",
      "https://pagead2.googlesyndication.com/x",
      "https://googlesyndication.com/x",
      "https://google.com/x",
    ];

    it.each(origins)(
      "permits %s in script-src, img-src and connect-src",
      (url) => {
        expect(permits("script-src", url)).toBe(true);
        expect(permits("img-src", url)).toBe(true);
        expect(permits("connect-src", url)).toBe(true);
      },
    );

    it("permits gstatic in frame-src", () => {
      expect(permits("frame-src", "https://www.gstatic.com/x")).toBe(true);
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

/**
 * The "HTTPS usage" line on the blog SEO checklist.
 *
 * This is a property of the deployment, not of any individual post, so it is
 * asserted once here rather than faked as a per-post check in
 * `src/lib/seo-audit.ts` that could only ever return the same answer. Neither
 * header was covered before.
 */
describe("HTTPS enforcement", () => {
  it("sends HSTS with a meaningful max-age", () => {
    const hsts = securityHeaders.find(
      (h) => h.key === "Strict-Transport-Security",
    );

    expect(hsts).toBeDefined();
    const maxAge = /max-age=(\d+)/.exec(hsts!.value);
    expect(maxAge).not.toBeNull();
    // Under a year and the preload lists will not take it.
    expect(Number(maxAge![1])).toBeGreaterThanOrEqual(31536000);
  });

  it("tells the browser to upgrade any insecure subresource", () => {
    expect(cspValue()).toContain("upgrade-insecure-requests");
  });

  it("does not permit a plain-http source anywhere in the CSP", () => {
    expect(cspValue()).not.toMatch(/\bhttp:\/\//);
  });
});
