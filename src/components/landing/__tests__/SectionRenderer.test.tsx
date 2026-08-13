/**
 * Renders one of every section kind.
 *
 * Partly for the behaviour worth pinning — that prices come from the live
 * table, that a nearby-areas mesh is computed rather than stored, and that an
 * unknown kind renders nothing instead of throwing — and partly for coverage
 * breadth: the section components would otherwise be a dozen untested files
 * dragging the global bucket in `jest.config.js` below its threshold.
 */

import { render, screen } from "@testing-library/react";
import SectionRenderer from "@/components/landing/SectionRenderer";
import type { ContentSection } from "@/lib/landing";
import type { PublicPriceTable } from "@/lib/pricing";

const table: PublicPriceTable = {
  machineBasePrice: () => 124.95,
  mixerPrice: () => 19.95,
  mixerLabel: () => "Margarita",
};

describe("SectionRenderer", () => {
  it("renders a hero with its eyebrow, heading and buttons", () => {
    render(
      <SectionRenderer
        table={null}
        section={{
          kind: "hero",
          eyebrow: "Central San Antonio",
          heading: "Margarita Machine Rental in Olmos Park",
          body: "Quiet streets and narrow driveways.",
          primaryCta: { label: "Check availability", href: "/order" },
          phoneCta: true,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Margarita Machine Rental in Olmos Park",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Central San Antonio")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Check availability" }),
    ).toHaveAttribute("href", "/order");
    // The number comes from site.ts, never from the stored document.
    expect(screen.getByRole("link", { name: /^Call/ })).toHaveAttribute(
      "href",
      expect.stringContaining("tel:"),
    );
  });

  it("renders authored HTML in a rich-text section", () => {
    const { container } = render(
      <SectionRenderer
        table={null}
        section={{ kind: "richText", html: "<p>Hello <em>there</em>.</p>" }}
      />,
    );

    expect(container.querySelector("em")).toHaveTextContent("there");
  });

  it("renders feature items", () => {
    render(
      <SectionRenderer
        table={null}
        section={{
          kind: "features",
          heading: "What delivery includes",
          items: [{ icon: "🚚", title: "Delivery", body: "A flat fee." }],
        }}
      />,
    );

    expect(screen.getByText(/A flat fee/)).toBeInTheDocument();
  });

  it("renders FAQ questions and answers", () => {
    render(
      <SectionRenderer
        table={null}
        section={{
          kind: "faq",
          items: [{ question: "Do you deliver?", answer: "Yes." }],
        }}
      />,
    );

    expect(screen.getByText("Do you deliver?")).toBeInTheDocument();
    expect(screen.getByText("Yes.")).toBeInTheDocument();
  });

  it("renders a booking CTA", () => {
    render(
      <SectionRenderer
        table={null}
        section={{ kind: "cta", headline: "Ready when you are" }}
      />,
    );

    expect(screen.getByText("Ready when you are")).toBeInTheDocument();
  });

  it("renders a link list and its footer link", () => {
    render(
      <SectionRenderer
        table={null}
        section={{
          kind: "linkList",
          items: [{ label: "Pricing", href: "/pricing" }],
          footerLink: { label: "See everything", href: "/service-area" },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(
      screen.getByRole("link", { name: "See everything" }),
    ).toBeInTheDocument();
  });

  describe("pricingCards", () => {
    it("prices from the live table rather than anything stored", () => {
      render(
        <SectionRenderer
          table={table}
          section={{ kind: "pricingCards", source: "machines" }}
        />,
      );

      expect(screen.getAllByText(/124\.95/).length).toBeGreaterThan(0);
    });

    // A null table means Settings was never read, which is only the case when
    // no pricing section was detected. Rendering a price here would be a lie.
    it("renders nothing without a price table", () => {
      const { container } = render(
        <SectionRenderer
          table={null}
          section={{ kind: "pricingCards", source: "machines" }}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("nearbyAreas", () => {
    it("computes the mesh from the service-area list", () => {
      render(
        <SectionRenderer
          table={null}
          section={{ kind: "nearbyAreas", forSlug: "olmos-park" }}
        />,
      );

      // Same region as Olmos Park, so it is always in the mesh.
      expect(
        screen.getByRole("link", { name: "Alamo Heights" }),
      ).toHaveAttribute("href", "/service-area/alamo-heights");
      expect(
        screen.queryByRole("link", { name: "Olmos Park" }),
      ).not.toBeInTheDocument();
    });

    it("renders nothing for an area that is not in the list", () => {
      const { container } = render(
        <SectionRenderer
          table={null}
          section={{ kind: "nearbyAreas", forSlug: "" }}
        />,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  // A document written by a newer deploy must not take the page into the error
  // boundary.
  it("renders nothing for a kind it does not know", () => {
    const { container } = render(
      <SectionRenderer
        table={null}
        section={{ kind: "carousel" } as unknown as ContentSection}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
