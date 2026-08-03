import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import GoogleTagManager, {
  GoogleTagManagerNoscript,
} from "../GoogleTagManager";

jest.mock("next/script", () => ({
  __esModule: true,
  default: ({
    dangerouslySetInnerHTML,
  }: {
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <div
      data-testid="script"
      data-inline={dangerouslySetInnerHTML?.__html ?? ""}
    />
  ),
}));

const ORIGINAL_ENV = process.env;

function setEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV, ...env } as NodeJS.ProcessEnv;
}

describe("GoogleTagManager", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    warn.mockRestore();
  });

  it("renders nothing outside production", () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_GTM_ID: "GTM-TEST123" });

    expect(render(<GoogleTagManager />).container.firstChild).toBeNull();
    expect(
      render(<GoogleTagManagerNoscript />).container.firstChild,
    ).toBeNull();
  });

  it("renders nothing and warns when the container id is unset", () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_GTM_ID: undefined });

    expect(render(<GoogleTagManager />).container.firstChild).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("bootstraps the configured container", () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_GTM_ID: "GTM-TEST123" });

    const { container } = render(<GoogleTagManager />);
    const inline = container
      .querySelector("[data-testid='script']")
      ?.getAttribute("data-inline");

    expect(inline).toContain("GTM-TEST123");
    expect(inline).toContain("https://www.googletagmanager.com/gtm.js?id=");
  });

  // Asserted against the server markup: jsdom has scripting enabled, so it
  // keeps <noscript> children as inert text and innerHTML reads back empty.
  // The server output is what a no-JS visitor actually receives anyway.
  it("points the noscript iframe at the same container", () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_GTM_ID: "GTM-TEST123" });

    expect(renderToStaticMarkup(<GoogleTagManagerNoscript />)).toContain(
      "https://www.googletagmanager.com/ns.html?id=GTM-TEST123",
    );
  });
});
