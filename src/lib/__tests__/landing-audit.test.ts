/**
 * @jest-environment node
 */
import {
  auditLandingPage,
  sectionsToHtml,
  type LandingAuditInput,
  type LandingCrossPageFacts,
} from "@/lib/landing-audit";
import {
  CONTENT_GOOD_WORDS,
  CONTENT_MIN_WORDS,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  DUPLICATE_SIMILARITY_MAX,
  SLUG_MAX_CHARS,
  SLUG_MAX_WORDS,
  TITLE_MAX,
  TITLE_MIN,
  type AuditReport,
  type AuditSeverity,
} from "@/lib/seo-audit";
import type { LandingSection } from "@/lib/landing";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

// Ten words each, so the paragraph and sentence maths below is exact. One of
// the two carries the focus keyword, which is how the density lands inside the
// range rather than near either edge.
const KEYWORD_SENTENCE =
  "A margarita machine keeps the party going all night long.";
const FILLER_SENTENCE =
  "Guests arrive early and stay late when the drinks flow.";

/** 13 paragraphs of 50 words: 650 words, 13 keyword hits, no long anything. */
function longHtml(): string {
  const paragraph = `<p>${[
    KEYWORD_SENTENCE,
    FILLER_SENTENCE,
    FILLER_SENTENCE,
    FILLER_SENTENCE,
    FILLER_SENTENCE,
  ].join(" ")}</p>`;
  return Array.from({ length: 13 }, () => paragraph).join("");
}

function validSections(): LandingSection[] {
  return [
    {
      kind: "hero",
      heading: "Margarita Machine Rental for Weddings",
      body: "Delivery, setup and pickup are included in one flat price.",
      primaryCta: { label: "Book now", href: "/order" },
    },
    {
      kind: "richText",
      heading: "Why a frozen machine wins",
      html: longHtml(),
    },
    {
      kind: "faq",
      heading: "Common questions",
      items: [
        {
          question: "How far ahead should we book?",
          answer: "Two to three weeks is comfortable for a weekend date.",
        },
      ],
    },
    {
      kind: "linkList",
      heading: "Nearby",
      items: [{ label: "Pricing", href: "/pricing" }],
    },
    {
      kind: "pricingCards",
      heading: "Machines and prices",
      source: "machines",
    },
  ];
}

/**
 * A page that passes every applicable check. Each test perturbs one field, so
 * a failure names the check that broke rather than the fixture.
 */
function validInput(
  overrides: Partial<LandingAuditInput> = {},
): LandingAuditInput {
  return {
    path: "/margarita-machine-rental-weddings",
    title: "Margarita Machine Rental for Weddings",
    seoDescription:
      "Rent a margarita machine for your San Antonio wedding reception, with delivery, setup and pickup included in one flat price.",
    ogImagePath: "/og-weddings.jpg",
    focusKeyword: "margarita machine",
    schemaType: "Service",
    serviceAreaName: "Alamo Heights, San Antonio, TX",
    sections: validSections(),
    status: "published",
    ...overrides,
  };
}

function validCrossPage(
  overrides: Partial<LandingCrossPageFacts> = {},
): LandingCrossPageFacts {
  return {
    duplicate: null,
    titleCollision: null,
    descriptionCollision: null,
    publishedPaths: ["/margarita-machine-rental-weddings"],
    publishedBlockSlugs: ["delivery-includes"],
    ...overrides,
  };
}

function check(report: AuditReport, id: string) {
  const found = report.checks.find((entry) => entry.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
}

function severityOf(input: LandingAuditInput, id: string): AuditSeverity {
  return check(auditLandingPage(input), id).severity;
}

/* -------------------------------------------------------------------------- */

describe("sectionsToHtml", () => {
  it("renders a hero heading as the page's H1", () => {
    const html = sectionsToHtml([{ kind: "hero", heading: "Frozen drinks" }]);
    expect(html).toContain("<h1>Frozen drinks</h1>");
  });

  it("renders every other section heading as an H2", () => {
    const html = sectionsToHtml([
      { kind: "cta", headline: "Ready?" },
      { kind: "pricingCards", heading: "Prices", source: "machines" },
    ]);
    expect(html).toContain("<h2>Ready?</h2>");
    expect(html).toContain("<h2>Prices</h2>");
  });

  it("passes authored rich text through verbatim", () => {
    const html = sectionsToHtml([
      {
        kind: "richText",
        html: '<p>Hello <a href="/order">book</a></p><img src="/a.jpg" alt="A">',
      },
    ]);
    expect(html).toContain('<a href="/order">book</a>');
    expect(html).toContain('<img src="/a.jpg" alt="A">');
  });

  it("emits an anchor for each CTA link so the link checks can see it", () => {
    const html = sectionsToHtml([
      {
        kind: "hero",
        heading: "Book",
        primaryCta: { label: "Order", href: "/order" },
        secondaryCta: { label: "Prices", href: "/pricing" },
      },
    ]);
    expect(html).toContain('href="/order"');
    expect(html).toContain('href="/pricing"');
  });

  it("contributes nothing for a blockRef, whose content is not loaded", () => {
    expect(sectionsToHtml([{ kind: "blockRef", blockSlug: "shared" }])).toBe(
      "",
    );
  });

  it("contributes no body text for pricing cards, which store none", () => {
    const html = sectionsToHtml([
      { kind: "pricingCards", source: "machines" },
      { kind: "nearbyAreas", forSlug: "alamo-heights" },
    ]);
    expect(html).toBe("");
  });
});

describe("title-length", () => {
  it("errors when there is no title at all", () => {
    expect(
      severityOf({ ...validInput(), title: "", seoTitle: "" }, "title-length"),
    ).toBe("error");
  });

  it("falls back to the title when no SEO title is set", () => {
    const report = auditLandingPage(validInput({ seoTitle: undefined }));
    expect(check(report, "title-length").value).toBe(
      "Margarita Machine Rental for Weddings".length,
    );
  });

  it("prefers the SEO title when both are set", () => {
    const report = auditLandingPage(
      validInput({ seoTitle: "a".repeat(TITLE_MIN + 5) }),
    );
    expect(check(report, "title-length").value).toBe(TITLE_MIN + 5);
  });

  it(`errors above ${TITLE_MAX} characters`, () => {
    expect(
      severityOf(
        validInput({ seoTitle: "a".repeat(TITLE_MAX + 1) }),
        "title-length",
      ),
    ).toBe("error");
  });

  it(`passes at exactly ${TITLE_MAX} characters`, () => {
    expect(
      severityOf(
        validInput({ seoTitle: "a".repeat(TITLE_MAX) }),
        "title-length",
      ),
    ).toBe("pass");
  });

  it(`warns below ${TITLE_MIN} characters`, () => {
    expect(
      severityOf(
        validInput({ seoTitle: "a".repeat(TITLE_MIN - 1) }),
        "title-length",
      ),
    ).toBe("warning");
  });
});

describe("meta-description-length", () => {
  it("errors when empty, because a landing page has no excerpt to fall back on", () => {
    expect(
      severityOf(validInput({ seoDescription: "" }), "meta-description-length"),
    ).toBe("error");
  });

  it(`warns above ${DESCRIPTION_MAX} characters`, () => {
    expect(
      severityOf(
        validInput({ seoDescription: "a".repeat(DESCRIPTION_MAX + 1) }),
        "meta-description-length",
      ),
    ).toBe("warning");
  });

  it(`warns below ${DESCRIPTION_MIN} characters`, () => {
    expect(
      severityOf(
        validInput({ seoDescription: "a".repeat(DESCRIPTION_MIN - 1) }),
        "meta-description-length",
      ),
    ).toBe("warning");
  });

  it(`passes at exactly ${DESCRIPTION_MIN} characters`, () => {
    expect(
      severityOf(
        validInput({ seoDescription: "a".repeat(DESCRIPTION_MIN) }),
        "meta-description-length",
      ),
    ).toBe("pass");
  });
});

describe("path-quality", () => {
  it.each(["", "/Not A Path", "/trailing-", "no-leading-slash", "/a/b/c/d/e"])(
    "errors on %p",
    (path) => {
      expect(severityOf(validInput({ path }), "path-quality")).toBe("error");
    },
  );

  it("errors on a path a real route already owns", () => {
    expect(severityOf(validInput({ path: "/order" }), "path-quality")).toBe(
      "error",
    );
  });

  it("accepts a service-area path, which is reserved only exactly", () => {
    expect(
      severityOf(
        validInput({ path: "/service-area/alamo-heights" }),
        "path-quality",
      ),
    ).toBe("pass");
  });

  it(`warns when the last segment exceeds ${SLUG_MAX_CHARS} characters`, () => {
    expect(
      severityOf(
        validInput({ path: `/${"a".repeat(SLUG_MAX_CHARS + 1)}` }),
        "path-quality",
      ),
    ).toBe("warning");
  });

  it(`warns above ${SLUG_MAX_WORDS} hyphenated words`, () => {
    const segment = Array.from({ length: SLUG_MAX_WORDS + 1 }, () => "a").join(
      "-",
    );
    expect(
      severityOf(validInput({ path: `/${segment}` }), "path-quality"),
    ).toBe("warning");
  });
});

describe("og-image", () => {
  it("warns when the page falls back to the site-wide card", () => {
    expect(severityOf(validInput({ ogImagePath: "" }), "og-image")).toBe(
      "warning",
    );
  });

  it("passes when a page-specific image is set", () => {
    expect(severityOf(validInput(), "og-image")).toBe("pass");
  });
});

describe("breadcrumbs", () => {
  it("warns on a nested page with no trail", () => {
    expect(
      severityOf(
        validInput({ path: "/service-area/alamo-heights", breadcrumbs: [] }),
        "breadcrumbs",
      ),
    ).toBe("warning");
  });

  it("passes on a nested page that has one", () => {
    expect(
      severityOf(
        validInput({
          path: "/service-area/alamo-heights",
          breadcrumbs: [{ name: "Service area", path: "/service-area" }],
        }),
        "breadcrumbs",
      ),
    ).toBe("pass");
  });

  it("passes on a top-level page with no trail", () => {
    expect(severityOf(validInput(), "breadcrumbs")).toBe("pass");
  });
});

describe("keyword checks", () => {
  it.each(["keyword-in-title", "keyword-in-path", "keyword-density"])(
    "skips %s with no focus keyword",
    (id) => {
      expect(severityOf(validInput({ focusKeyword: "" }), id)).toBe("skipped");
    },
  );

  it("passes when the keyword is in the title", () => {
    expect(severityOf(validInput(), "keyword-in-title")).toBe("pass");
  });

  it("warns when it is not", () => {
    expect(
      severityOf(
        validInput({ focusKeyword: "frozen daiquiri" }),
        "keyword-in-title",
      ),
    ).toBe("warning");
  });

  it("hyphenates a multi-word keyword before looking in the path", () => {
    expect(severityOf(validInput(), "keyword-in-path")).toBe("pass");
  });

  it("warns when the path does not contain it", () => {
    expect(
      severityOf(validInput({ path: "/weddings" }), "keyword-in-path"),
    ).toBe("warning");
  });

  it("keeps density inside the range for the fixture", () => {
    expect(severityOf(validInput(), "keyword-density")).toBe("pass");
  });

  it("warns when the keyword never appears in the body", () => {
    expect(
      severityOf(
        validInput({ focusKeyword: "frozen daiquiri" }),
        "keyword-density",
      ),
    ).toBe("warning");
  });

  it("errors when there is a keyword but no text at all", () => {
    expect(severityOf(validInput({ sections: [] }), "keyword-density")).toBe(
      "error",
    );
  });
});

describe("content-length", () => {
  it(`errors under ${CONTENT_MIN_WORDS} words`, () => {
    expect(severityOf(validInput({ sections: [] }), "content-length")).toBe(
      "error",
    );
  });

  it(`warns under ${CONTENT_GOOD_WORDS} words`, () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: `<p>${"word ".repeat(CONTENT_MIN_WORDS)}</p>` },
    ];
    expect(severityOf(validInput({ sections }), "content-length")).toBe(
      "warning",
    );
  });

  it("passes on the fixture", () => {
    expect(severityOf(validInput(), "content-length")).toBe("pass");
  });

  it("does not count pricing cards or nearby areas, which store no text", () => {
    const sections: LandingSection[] = [
      { kind: "pricingCards", source: "machines" },
      { kind: "nearbyAreas", forSlug: "alamo-heights" },
    ];
    expect(check(auditLandingPage({ sections }), "content-length").value).toBe(
      "0 words",
    );
  });
});

describe("heading-structure", () => {
  it("passes with one hero and an H2 beneath it", () => {
    expect(severityOf(validInput(), "heading-structure")).toBe("pass");
  });

  it("errors on a second hero, which would render a second H1", () => {
    const sections = [...validSections(), validSections()[0]];
    expect(severityOf(validInput({ sections }), "heading-structure")).toBe(
      "error",
    );
  });

  it("errors on an h1 inside rich text", () => {
    const sections = validSections().map((section) =>
      section.kind === "richText"
        ? { ...section, html: `<h1>Second</h1>${section.html}` }
        : section,
    );
    expect(severityOf(validInput({ sections }), "heading-structure")).toBe(
      "error",
    );
  });

  it("warns when there is no hero, so no H1", () => {
    const sections = validSections().filter(
      (section) => section.kind !== "hero",
    );
    expect(severityOf(validInput({ sections }), "heading-structure")).toBe(
      "warning",
    );
  });

  it("warns when a level is skipped", () => {
    const sections: LandingSection[] = [
      { kind: "hero", heading: "One" },
      { kind: "richText", html: "<h3>Three</h3><p>Body.</p>" },
    ];
    expect(severityOf(validInput({ sections }), "heading-structure")).toBe(
      "warning",
    );
  });

  it("warns when there is no H2 anywhere", () => {
    const sections: LandingSection[] = [{ kind: "hero", heading: "Only" }];
    expect(severityOf(validInput({ sections }), "heading-structure")).toBe(
      "warning",
    );
  });
});

describe("readability", () => {
  it("passes on short sentences and paragraphs", () => {
    expect(severityOf(validInput(), "readability")).toBe("pass");
  });

  it("skips when there is no text", () => {
    expect(severityOf(validInput({ sections: [] }), "readability")).toBe(
      "skipped",
    );
  });

  it("warns on a paragraph far over the limit", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: `<p>${"word ".repeat(400)}.</p>` },
    ];
    expect(severityOf(validInput({ sections }), "readability")).toBe("warning");
  });
});

describe("cta-present", () => {
  it("passes on a hero with a primary CTA", () => {
    expect(severityOf(validInput(), "cta-present")).toBe("pass");
  });

  it("passes on a dedicated CTA section", () => {
    const sections: LandingSection[] = [{ kind: "cta", headline: "Book" }];
    expect(severityOf(validInput({ sections }), "cta-present")).toBe("pass");
  });

  it("passes on a hero that only offers the phone number", () => {
    const sections: LandingSection[] = [
      { kind: "hero", heading: "Call us", phoneCta: true },
    ];
    expect(severityOf(validInput({ sections }), "cta-present")).toBe("pass");
  });

  it("warns when the page asks for nothing", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: "<p>Words only.</p>" },
    ];
    expect(severityOf(validInput({ sections }), "cta-present")).toBe("warning");
  });
});

describe("cross-page checks", () => {
  it.each([
    "duplicate-meta",
    "duplicate-content",
    "link-targets",
    "block-refs",
  ])("skips %s until the check has been run", (id) => {
    expect(severityOf(validInput(), id)).toBe("skipped");
  });

  it("passes duplicate-content when nothing is close", () => {
    expect(
      severityOf(
        validInput({
          crossPage: validCrossPage({
            duplicate: { path: "/other", similarity: DUPLICATE_SIMILARITY_MAX },
          }),
        }),
        "duplicate-content",
      ),
    ).toBe("pass");
  });

  it(`warns above ${DUPLICATE_SIMILARITY_MAX} similarity`, () => {
    const report = auditLandingPage(
      validInput({
        crossPage: validCrossPage({
          duplicate: { path: "/other", similarity: 0.62 },
        }),
      }),
    );
    expect(check(report, "duplicate-content").severity).toBe("warning");
    expect(check(report, "duplicate-content").message).toContain("/other");
    expect(check(report, "duplicate-content").value).toBe("62%");
  });

  it("warns on a title collision and names the other page", () => {
    const report = auditLandingPage(
      validInput({
        crossPage: validCrossPage({
          titleCollision: "/service-area/alamo-heights",
        }),
      }),
    );
    expect(check(report, "duplicate-meta").severity).toBe("warning");
    expect(check(report, "duplicate-meta").message).toContain(
      "/service-area/alamo-heights",
    );
  });

  it("warns on a description collision alone", () => {
    expect(
      severityOf(
        validInput({
          crossPage: validCrossPage({ descriptionCollision: "/other" }),
        }),
        "duplicate-meta",
      ),
    ).toBe("warning");
  });

  it("passes duplicate-meta when both are unique", () => {
    expect(
      severityOf(validInput({ crossPage: validCrossPage() }), "duplicate-meta"),
    ).toBe("pass");
  });
});

describe("links", () => {
  it("warns when there are no internal links", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: "<p>No links here.</p>" },
    ];
    expect(severityOf(validInput({ sections }), "internal-links")).toBe(
      "warning",
    );
  });

  it("counts CTA links, not just anchors in rich text", () => {
    expect(check(auditLandingPage(validInput()), "internal-links").value).toBe(
      2,
    );
  });

  it("passes link-targets when every href resolves", () => {
    expect(
      severityOf(validInput({ crossPage: validCrossPage() }), "link-targets"),
    ).toBe("pass");
  });

  it("treats a reserved route as resolvable without a stored page", () => {
    const sections: LandingSection[] = [
      {
        kind: "linkList",
        items: [{ label: "A post", href: "/blog/frozen-drinks" }],
      },
    ];
    expect(
      severityOf(
        validInput({ sections, crossPage: validCrossPage() }),
        "link-targets",
      ),
    ).toBe("pass");
  });

  it("ignores a fragment and a query when resolving", () => {
    const sections: LandingSection[] = [
      {
        kind: "linkList",
        items: [{ label: "Prices", href: "/pricing?a=1#top" }],
      },
    ];
    expect(
      severityOf(
        validInput({ sections, crossPage: validCrossPage() }),
        "link-targets",
      ),
    ).toBe("pass");
  });

  it("warns on a link to a path nothing serves", () => {
    const sections: LandingSection[] = [
      { kind: "linkList", items: [{ label: "Gone", href: "/nowhere-at-all" }] },
    ];
    const report = auditLandingPage(
      validInput({ sections, crossPage: validCrossPage() }),
    );
    expect(check(report, "link-targets").severity).toBe("warning");
    expect(check(report, "link-targets").message).toContain("/nowhere-at-all");
  });

  it("warns on an external link with no rel", () => {
    const sections: LandingSection[] = [
      {
        kind: "richText",
        html: '<p><a href="https://example.com">Elsewhere</a></p>',
      },
    ];
    expect(severityOf(validInput({ sections }), "external-links")).toBe(
      "warning",
    );
  });
});

describe("image-alt-text", () => {
  it("passes when the page has no images", () => {
    expect(severityOf(validInput(), "image-alt-text")).toBe("pass");
  });

  it("errors on a rich-text image with no alt attribute", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: '<p><img src="/a.jpg"></p>' },
    ];
    expect(severityOf(validInput({ sections }), "image-alt-text")).toBe(
      "error",
    );
  });

  it("errors on a blank alt attribute too", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: '<p><img src="/a.jpg" alt="  "></p>' },
    ];
    expect(severityOf(validInput({ sections }), "image-alt-text")).toBe(
      "error",
    );
  });

  it("passes when every image is described", () => {
    const sections: LandingSection[] = [
      { kind: "richText", html: '<p><img src="/a.jpg" alt="A machine"></p>' },
    ];
    expect(severityOf(validInput({ sections }), "image-alt-text")).toBe("pass");
  });
});

describe("section-config", () => {
  it("passes on a fully configured page", () => {
    expect(severityOf(validInput(), "section-config")).toBe("pass");
  });

  it("errors on a blockRef with no block chosen", () => {
    const sections: LandingSection[] = [{ kind: "blockRef", blockSlug: "" }];
    expect(severityOf(validInput({ sections }), "section-config")).toBe(
      "error",
    );
  });

  it("errors on nearbyAreas pointing at a slug that is not a service area", () => {
    const sections: LandingSection[] = [
      { kind: "nearbyAreas", forSlug: "not-a-real-area" },
    ];
    expect(severityOf(validInput({ sections }), "section-config")).toBe(
      "error",
    );
  });

  it("passes on a real service area slug", () => {
    const sections: LandingSection[] = [
      { kind: "nearbyAreas", forSlug: "alamo-heights" },
    ];
    expect(severityOf(validInput({ sections }), "section-config")).toBe("pass");
  });
});

describe("block-refs", () => {
  it("errors on a slug that is not a published block", () => {
    const sections: LandingSection[] = [
      { kind: "blockRef", blockSlug: "still-a-draft" },
    ];
    const report = auditLandingPage(
      validInput({ sections, crossPage: validCrossPage() }),
    );
    expect(check(report, "block-refs").severity).toBe("error");
    expect(check(report, "block-refs").message).toContain("still-a-draft");
  });

  it("passes on a published block", () => {
    const sections: LandingSection[] = [
      { kind: "blockRef", blockSlug: "delivery-includes" },
    ];
    expect(
      severityOf(
        validInput({ sections, crossPage: validCrossPage() }),
        "block-refs",
      ),
    ).toBe("pass");
  });

  it("passes when the page uses no shared blocks", () => {
    expect(
      severityOf(validInput({ crossPage: validCrossPage() }), "block-refs"),
    ).toBe("pass");
  });
});

describe("structured-data", () => {
  it("passes on Service with an area served and pricing cards", () => {
    expect(severityOf(validInput(), "structured-data")).toBe("pass");
  });

  it("warns on Service with no area served", () => {
    expect(
      severityOf(validInput({ serviceAreaName: "" }), "structured-data"),
    ).toBe("warning");
  });

  it("warns on Service with no pricing cards, which drops the offers node", () => {
    const sections = validSections().filter(
      (section) => section.kind !== "pricingCards",
    );
    expect(severityOf(validInput({ sections }), "structured-data")).toBe(
      "warning",
    );
  });

  it("errors on FAQPage with no FAQ section, which emits no node at all", () => {
    const sections = validSections().filter(
      (section) => section.kind !== "faq",
    );
    expect(
      severityOf(
        validInput({ schemaType: "FAQPage", sections }),
        "structured-data",
      ),
    ).toBe("error");
  });

  it("passes FAQPage when there is FAQ content", () => {
    expect(
      severityOf(validInput({ schemaType: "FAQPage" }), "structured-data"),
    ).toBe("pass");
  });

  it("warns when FAQ content is present but the type is none", () => {
    expect(
      severityOf(validInput({ schemaType: "none" }), "structured-data"),
    ).toBe("warning");
  });

  it("passes WebPage, which has nothing extra to satisfy", () => {
    expect(
      severityOf(validInput({ schemaType: "WebPage" }), "structured-data"),
    ).toBe("pass");
  });
});

describe("sitemap-inclusion", () => {
  it("passes when published", () => {
    expect(severityOf(validInput(), "sitemap-inclusion")).toBe("pass");
  });

  it("skips a draft rather than failing it", () => {
    expect(
      severityOf(validInput({ status: "draft" }), "sitemap-inclusion"),
    ).toBe("skipped");
  });
});

describe("scoring", () => {
  it("scores the well-formed fixture at 100 with no errors", () => {
    const report = auditLandingPage(validInput());
    expect(report.errors).toBe(0);
    expect(report.warnings).toBe(0);
    expect(report.score).toBe(100);
  });

  it("excludes skipped checks from the denominator", () => {
    const report = auditLandingPage(validInput());
    const applicable = report.checks.filter(
      (entry) => entry.severity !== "skipped",
    );
    const passes = applicable.filter((entry) => entry.severity === "pass");
    expect(applicable.length).toBeLessThan(report.checks.length);
    expect(report.score).toBe(
      Math.round((passes.length / applicable.length) * 100),
    );
  });

  it("counts errors and warnings separately", () => {
    const report = auditLandingPage(
      validInput({ seoDescription: "", ogImagePath: "" }),
    );
    expect(report.errors).toBeGreaterThan(0);
    expect(report.warnings).toBeGreaterThan(0);
  });

  it("returns every check regardless of input, so the panel never reflows", () => {
    const empty = auditLandingPage({}).checks.map((entry) => entry.id);
    const full = auditLandingPage(
      validInput({ crossPage: validCrossPage() }),
    ).checks.map((entry) => entry.id);
    expect(empty).toEqual(full);
  });

  it("tolerates a completely empty input", () => {
    expect(() => auditLandingPage({})).not.toThrow();
    expect(auditLandingPage({}).checks.length).toBeGreaterThan(0);
  });
});
