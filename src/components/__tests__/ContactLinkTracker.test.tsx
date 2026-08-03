import { render } from "@testing-library/react";
import ContactLinkTracker from "../ContactLinkTracker";
import { trackEvent } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

const trackEventMock = trackEvent as jest.Mock;

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
    render(<ContactLinkTracker />);
  });

  it("tracks a phone click", () => {
    clickLink("tel:+15122100194");

    expect(trackEventMock).toHaveBeenCalledWith("contact_click", {
      method: "phone",
      link_url: "tel:+15122100194",
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
