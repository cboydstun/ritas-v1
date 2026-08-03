import { render } from "@testing-library/react";
import AnalyticsGate from "../AnalyticsGate";

const usePathname = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

jest.mock("../GoogleAnalytics", () => ({
  __esModule: true,
  default: () => <div data-testid="ga" />,
}));

jest.mock("../GoogleTagManager", () => ({
  __esModule: true,
  default: () => <div data-testid="gtm" />,
  GoogleTagManagerNoscript: () => <div data-testid="gtm-noscript" />,
}));

describe("AnalyticsGate", () => {
  it.each(["/admin", "/admin/login", "/admin/analytics"])(
    "renders no tags on %s",
    (pathname) => {
      usePathname.mockReturnValue(pathname);

      expect(render(<AnalyticsGate />).container.firstChild).toBeNull();
    },
  );

  it.each(["/", "/order", "/pricing", "/success"])(
    "renders the tags on %s",
    (pathname) => {
      usePathname.mockReturnValue(pathname);

      const { queryByTestId } = render(<AnalyticsGate />);

      expect(queryByTestId("ga")).not.toBeNull();
      expect(queryByTestId("gtm")).not.toBeNull();
      expect(queryByTestId("gtm-noscript")).not.toBeNull();
    },
  );

  // Consent defaults live in GoogleAnalytics and must reach dataLayer before
  // the GTM container boots and starts firing the Ads tags.
  it("renders GoogleAnalytics before GoogleTagManager", () => {
    usePathname.mockReturnValue("/");

    const { container } = render(<AnalyticsGate />);
    const ids = Array.from(container.querySelectorAll("[data-testid]")).map(
      (node) => node.getAttribute("data-testid"),
    );

    expect(ids.indexOf("ga")).toBeLessThan(ids.indexOf("gtm"));
  });
});
