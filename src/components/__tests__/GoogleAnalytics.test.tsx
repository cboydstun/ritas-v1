import { render } from "@testing-library/react";
import GoogleAnalytics from "../GoogleAnalytics";

// next/script needs the App Router runtime to actually inject anything. The
// component's job here is deciding *whether* to emit and *what* the payload
// says, so stand it in with a plain element the test can read.
jest.mock("next/script", () => ({
  __esModule: true,
  default: ({
    src,
    dangerouslySetInnerHTML,
  }: {
    src?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <div
      data-testid="script"
      data-src={src ?? ""}
      data-inline={dangerouslySetInnerHTML?.__html ?? ""}
    />
  ),
}));

const ORIGINAL_ENV = process.env;

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...env } as NodeJS.ProcessEnv;
}

function inlineScript(container: HTMLElement): string {
  return Array.from(container.querySelectorAll("[data-testid='script']"))
    .map((node) => node.getAttribute("data-inline") ?? "")
    .join("\n");
}

describe("GoogleAnalytics", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    warn.mockRestore();
  });

  it("renders nothing outside production", () => {
    setEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TESTID1234",
    });

    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing and warns when the measurement id is unset", () => {
    setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: undefined,
    });

    const { container } = render(<GoogleAnalytics />);

    expect(container.firstChild).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  describe("in production with a measurement id", () => {
    beforeEach(() => {
      setEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TESTID1234",
      });
    });

    it("loads gtag.js for that measurement id", () => {
      const { container } = render(<GoogleAnalytics />);

      const loader = Array.from(
        container.querySelectorAll("[data-testid='script']"),
      ).find((node) => node.getAttribute("data-src"));

      expect(loader?.getAttribute("data-src")).toBe(
        "https://www.googletagmanager.com/gtag/js?id=G-TESTID1234",
      );
    });

    it("configures the same measurement id", () => {
      const { container } = render(<GoogleAnalytics />);

      expect(inlineScript(container)).toContain(
        "gtag('config', 'G-TESTID1234')",
      );
    });

    // trackEvent() reads window.gtag; the bare function declaration alone is
    // not enough to guarantee it under a bundler.
    it("exposes gtag on window", () => {
      const { container } = render(<GoogleAnalytics />);

      expect(inlineScript(container)).toContain("window.gtag = gtag");
    });

    // Consent defaults are worthless if they land after config.
    it("emits Consent Mode defaults before configuring the property", () => {
      const inline = inlineScript(render(<GoogleAnalytics />).container);

      const consentAt = inline.indexOf("gtag('consent', 'default'");
      const configAt = inline.indexOf("gtag('config'");

      expect(consentAt).toBeGreaterThan(-1);
      expect(configAt).toBeGreaterThan(consentAt);
    });

    it("defaults every consent signal to granted", () => {
      const inline = inlineScript(render(<GoogleAnalytics />).container);

      for (const signal of [
        "ad_storage",
        "ad_user_data",
        "ad_personalization",
        "analytics_storage",
      ]) {
        expect(inline).toContain(`${signal}: 'granted'`);
      }
    });

    // Without this a returning visitor's opt-out would not apply until React
    // hydrated, by which time the first hit has already gone out.
    it("re-applies a stored opt-out before the first hit", () => {
      const inline = inlineScript(render(<GoogleAnalytics />).container);

      expect(inline).toContain("satx-ritas-consent");
      expect(inline).toContain("gtag('consent', 'update'");
    });
  });
});
