import { render } from "@testing-library/react";
import ContactLinkTracker from "../ContactLinkTracker";
import {
  trackEvent,
  pushDataLayer,
  LEAD_VALUES,
  ANALYTICS_CURRENCY,
} from "@/lib/analytics";

// Stub the two senders. A mock that omits one makes the missing export
// `undefined`, and the component throws on the call — see CLAUDE.md.
//
// The constants are spread in from the real module rather than restated: a
// literal here would keep passing after someone changed the shipped lead value,
// which is the one thing these assertions exist to notice.
jest.mock("@/lib/analytics", () => ({
  ...jest.requireActual("@/lib/analytics"),
  trackEvent: jest.fn(),
  pushDataLayer: jest.fn(),
}));

const trackEventMock = trackEvent as jest.Mock;
const pushDataLayerMock = pushDataLayer as jest.Mock;

function clickLink(href: string, text = "link") {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  anchor.textContent = text;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

describe("ContactLinkTracker", () => {
  beforeEach(() => {
    trackEventMock.mockClear();
    pushDataLayerMock.mockClear();
    render(<ContactLinkTracker />);
  });

  it("tracks a phone click", () => {
    clickLink("tel:+15122100194");

    expect(trackEventMock).toHaveBeenCalledWith("contact_click", {
      method: "phone",
      link_url: "tel:+15122100194",
      value: LEAD_VALUES.phone_call,
      currency: ANALYTICS_CURRENCY,
    });
  });

  it("tracks an email click", () => {
    clickLink("mailto:satxbounce@gmail.com");

    expect(trackEventMock).toHaveBeenCalledWith("contact_click", {
      method: "email",
      link_url: "mailto:satxbounce@gmail.com",
    });
  });

  it("tracks a PDF download with its link text", () => {
    clickLink("/docs/lease.pdf", "Download Lease Documentation (PDF)");

    expect(trackEventMock).toHaveBeenCalledWith("file_download", {
      file_extension: "pdf",
      file_name: "Download Lease Documentation (PDF)",
      link_url: "/docs/lease.pdf",
    });
  });

  // The lease PDF url is admin-configurable and may carry a signed query.
  it("tracks a PDF whose url has a query string", () => {
    clickLink("https://cdn.example.com/lease.PDF?sig=abc", "Lease");

    expect(trackEventMock).toHaveBeenCalledWith(
      "file_download",
      expect.objectContaining({ file_extension: "pdf" }),
    );
  });

  // The Google Ads phone-lead conversion fires off this push, not off gtag.
  it("mirrors a phone click to the dataLayer", () => {
    clickLink("tel:+15122100194");

    expect(pushDataLayerMock).toHaveBeenCalledWith("contact_click", {
      method: "phone",
      value: LEAD_VALUES.phone_call,
      currency: ANALYTICS_CURRENCY,
    });
  });

  it("mirrors an email click to the dataLayer", () => {
    clickLink("mailto:satxbounce@gmail.com");

    expect(pushDataLayerMock).toHaveBeenCalledWith("contact_click", {
      method: "email",
    });
  });

  // The Ads tag is scoped to phone. A download must not reach the dataLayer at
  // all, or the GTM trigger becomes the only thing standing between a PDF
  // click and a counted phone lead.
  it("does not push a download to the dataLayer", () => {
    clickLink("/docs/lease.pdf", "Lease");

    expect(trackEventMock).toHaveBeenCalledWith(
      "file_download",
      expect.anything(),
    );
    expect(pushDataLayerMock).not.toHaveBeenCalled();
  });

  // `Settings.documentation.pdfUrl` only has to be an http(s) url, so the
  // real lease link is quite likely to be a Drive or Dropbox share with no
  // `.pdf` anywhere in it. The attribute is what makes those track.
  it("tracks a download marked with data-track-download regardless of extension", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://drive.google.com/file/d/abc123/view");
    anchor.setAttribute("data-track-download", "pdf");
    anchor.textContent = "Lease Documentation";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    expect(trackEventMock).toHaveBeenCalledWith("file_download", {
      file_extension: "pdf",
      file_name: "Lease Documentation",
      link_url: "https://drive.google.com/file/d/abc123/view",
    });
  });

  it("strips a fragment before testing the extension", () => {
    clickLink("/docs/lease.pdf#page=2", "Lease");

    expect(trackEventMock).toHaveBeenCalledWith(
      "file_download",
      expect.objectContaining({ file_extension: "pdf" }),
    );
  });

  // Middle-click and open-in-new-tab fire `auxclick` and no `click` at all.
  it("tracks a middle-click", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "/docs/lease.pdf");
    anchor.textContent = "Lease";
    document.body.appendChild(anchor);
    anchor.dispatchEvent(
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    anchor.remove();

    expect(trackEventMock).toHaveBeenCalledWith(
      "file_download",
      expect.objectContaining({ link_url: "/docs/lease.pdf" }),
    );
  });

  it("fires when the click lands on a child of the anchor", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "tel:+15122100194");
    const span = document.createElement("span");
    span.textContent = "Call us";
    anchor.appendChild(span);
    document.body.appendChild(anchor);

    span.click();
    anchor.remove();

    expect(trackEventMock).toHaveBeenCalledWith(
      "contact_click",
      expect.objectContaining({ method: "phone" }),
    );
  });

  it("ignores ordinary navigation links", () => {
    clickLink("/pricing");

    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it("renders no DOM of its own", () => {
    const { container } = render(<ContactLinkTracker />);
    expect(container.firstChild).toBeNull();
  });
});
