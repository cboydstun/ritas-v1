/**
 * @jest-environment node
 *
 * The pure half of the landing-page feature: path shape, the reserved list,
 * block resolution and the section factory. No mongoose, no database.
 *
 * `defaultSection` is checked against the real zod union rather than by hand.
 * An editor that can add a section the API then rejects is unusable, and that
 * is a mismatch only a cross-module assertion catches.
 */

import {
  CONTENT_SECTION_KINDS,
  MAX_PATH_SEGMENTS,
  MAX_SECTIONS,
  SECTION_KINDS,
  blockSlugsIn,
  defaultSection,
  isContentSectionKind,
  isLandingPath,
  isLandingStatus,
  isReservedPath,
  isSafeHref,
  isSectionKind,
  landingPathFromSegments,
  landingPathToSegments,
  pathify,
  resolveSections,
  sectionShapeError,
  type ContentSection,
  type LandingSection,
} from "@/lib/landing";
import { pageSectionSchema } from "@/lib/validation";

describe("isLandingPath", () => {
  it.each(["/order-a-machine", "/service-area/olmos-park", "/a/b/c/d", "/x1"])(
    "accepts %s",
    (path) => {
      expect(isLandingPath(path)).toBe(true);
    },
  );

  it.each([
    ["no leading slash", "service-area/olmos-park"],
    ["trailing slash", "/service-area/"],
    ["uppercase", "/Service-Area"],
    ["doubled slash", "/service-area//olmos-park"],
    ["traversal", "/service-area/../admin"],
    ["a dot, so no static file can be shadowed", "/og-image.jpg"],
    ["a decoded %2F inside a segment", "/service area/x"],
    ["underscore", "/service_area"],
    ["leading hyphen", "/-nope"],
    ["trailing hyphen", "/nope-"],
    ["empty", ""],
    ["bare slash", "/"],
    ["query string", "/page?a=1"],
    ["fragment", "/page#top"],
  ])("rejects %s", (_label, path) => {
    expect(isLandingPath(path)).toBe(false);
  });

  it("rejects more than MAX_PATH_SEGMENTS segments", () => {
    const tooDeep =
      "/" +
      Array(MAX_PATH_SEGMENTS + 1)
        .fill("a")
        .join("/");
    expect(isLandingPath(tooDeep)).toBe(false);
  });

  it("rejects an over-long path", () => {
    expect(isLandingPath("/" + "a".repeat(300))).toBe(false);
  });
});

describe("segment conversion", () => {
  it("round-trips", () => {
    const path = "/service-area/olmos-park";
    expect(landingPathFromSegments(landingPathToSegments(path))).toBe(path);
  });

  it("returns null for junk rather than throwing", () => {
    expect(landingPathFromSegments(["og-image.jpg"])).toBeNull();
    expect(landingPathFromSegments([])).toBeNull();
    expect(landingPathFromSegments(["a", "b", "c", "d", "e"])).toBeNull();
  });
});

describe("pathify", () => {
  it("slugifies each segment", () => {
    expect(pathify("Service Area / Olmos Park")).toBe(
      "/service-area/olmos-park",
    );
  });

  it("strips accents rather than dropping the letter", () => {
    expect(pathify("Quinceañera")).toBe("/quinceanera");
  });

  it("returns an empty string when nothing survives", () => {
    expect(pathify("///")).toBe("");
  });

  it("produces something isLandingPath accepts", () => {
    expect(isLandingPath(pathify("Weddings & Receptions"))).toBe(true);
  });
});

describe("isReservedPath", () => {
  it.each([
    "/",
    "/order",
    "/pricing",
    "/blog",
    "/blog/some-post",
    "/admin",
    "/admin/landing-pages",
    "/api/v1/settings",
    "/success",
    "/service-area",
  ])("reserves %s", (path) => {
    expect(isReservedPath(path)).toBe(true);
  });

  // The asymmetry the whole feature depends on: the hub owns the bare path,
  // but everything below it is where the seeded city pages live.
  it("does not reserve a path below the service-area hub", () => {
    expect(isReservedPath("/service-area/olmos-park")).toBe(false);
  });

  it("does not reserve an unrelated path", () => {
    expect(isReservedPath("/margarita-machine-rental-weddings")).toBe(false);
  });
});

describe("isSafeHref", () => {
  it.each([
    "/order",
    "/service-area/olmos-park",
    "tel:+12105551234",
    "mailto:a@b.co",
  ])("accepts %s", (href) => {
    expect(isSafeHref(href)).toBe(true);
  });

  it.each([
    ["absolute remote", "https://evil.example/x"],
    ["protocol-relative", "//evil.example/x"],
    ["javascript scheme", "javascript:alert(1)"],
    ["backslash separator", "/a\\b"],
    ["traversal", "/../admin"],
    ["whitespace", "/a b"],
    ["empty tel", "tel:"],
  ])("rejects %s", (_label, href) => {
    expect(isSafeHref(href)).toBe(false);
  });
});

describe("type guards", () => {
  it("recognises statuses", () => {
    expect(isLandingStatus("draft")).toBe(true);
    expect(isLandingStatus("published")).toBe(true);
    expect(isLandingStatus("archived")).toBe(false);
    expect(isLandingStatus(2)).toBe(false);
  });

  it("recognises section kinds", () => {
    expect(isSectionKind("hero")).toBe(true);
    expect(isSectionKind("blockRef")).toBe(true);
    expect(isSectionKind("carousel")).toBe(false);
  });

  it("excludes blockRef from the content kinds", () => {
    expect(isContentSectionKind("hero")).toBe(true);
    expect(isContentSectionKind("blockRef")).toBe(false);
  });
});

describe("blockSlugsIn", () => {
  it("dedupes and preserves first-seen order", () => {
    const sections: LandingSection[] = [
      { kind: "blockRef", blockSlug: "b" },
      { kind: "cta" },
      { kind: "blockRef", blockSlug: "a" },
      { kind: "blockRef", blockSlug: "b" },
    ];
    expect(blockSlugsIn(sections)).toEqual(["b", "a"]);
  });

  it("skips an unset slug", () => {
    expect(blockSlugsIn([{ kind: "blockRef", blockSlug: "" }])).toEqual([]);
  });
});

describe("resolveSections", () => {
  const cta: ContentSection = { kind: "cta", headline: "Book" };
  const faq: ContentSection = {
    kind: "faq",
    heading: "Questions",
    items: [{ question: "q", answer: "a" }],
  };

  it("passes non-ref sections through untouched", () => {
    expect(resolveSections([cta], new Map())).toEqual([cta]);
  });

  // A deleted block must not take down a page that is otherwise fine.
  it("drops a ref whose block is missing", () => {
    const sections: LandingSection[] = [
      cta,
      { kind: "blockRef", blockSlug: "gone" },
    ];
    expect(resolveSections(sections, new Map())).toEqual([cta]);
  });

  it("drops a ref whose block resolved to nothing", () => {
    const blocks = new Map<string, ContentSection[]>([["empty", []]]);
    expect(
      resolveSections([{ kind: "blockRef", blockSlug: "empty" }], blocks),
    ).toEqual([]);
  });

  it("flattens a multi-section block in order", () => {
    const blocks = new Map<string, ContentSection[]>([["combo", [faq, cta]]]);
    expect(
      resolveSections([{ kind: "blockRef", blockSlug: "combo" }], blocks),
    ).toEqual([faq, cta]);
  });

  it("applies headingOverride to the first section only", () => {
    const blocks = new Map<string, ContentSection[]>([["combo", [faq, faq]]]);
    const [first, second] = resolveSections(
      [{ kind: "blockRef", blockSlug: "combo", headingOverride: "Local FAQ" }],
      blocks,
    );
    expect(first).toMatchObject({ heading: "Local FAQ" });
    expect(second).toMatchObject({ heading: "Questions" });
  });

  it("ignores headingOverride on a section that has no heading", () => {
    const noHeading: ContentSection = {
      kind: "pricingCards",
      source: "machines",
    };
    const blocks = new Map<string, ContentSection[]>([["p", [noHeading]]]);
    expect(
      resolveSections(
        [{ kind: "blockRef", blockSlug: "p", headingOverride: "Nope" }],
        blocks,
      ),
    ).toEqual([noHeading]);
  });

  it("does not mutate the block it resolves", () => {
    const blocks = new Map<string, ContentSection[]>([["combo", [faq]]]);
    resolveSections(
      [{ kind: "blockRef", blockSlug: "combo", headingOverride: "Changed" }],
      blocks,
    );
    expect(faq.heading).toBe("Questions");
  });
});

describe("sectionShapeError", () => {
  it("accepts a well-formed page list", () => {
    expect(
      sectionShapeError(
        [{ kind: "cta" }, { kind: "blockRef", blockSlug: "x" }],
        {
          allowBlockRef: true,
        },
      ),
    ).toBeNull();
  });

  it("rejects a blockRef inside a shared block", () => {
    expect(
      sectionShapeError([{ kind: "blockRef", blockSlug: "x" }], {
        allowBlockRef: false,
      }),
    ).toMatch(/known kind/);
  });

  it.each([
    ["a non-array", "nope", /array/],
    ["a null element", [null], /object/],
    ["an array element", [[]], /object/],
    ["an unknown kind", [{ kind: "carousel" }], /known kind/],
  ])("rejects %s", (_label, value, pattern) => {
    expect(sectionShapeError(value, { allowBlockRef: true })).toMatch(
      pattern as RegExp,
    );
  });

  it("rejects more than MAX_SECTIONS", () => {
    const many = Array(MAX_SECTIONS + 1).fill({ kind: "cta" });
    expect(sectionShapeError(many, { allowBlockRef: true })).toMatch(
      /more than/,
    );
  });
});

describe("defaultSection", () => {
  it.each(SECTION_KINDS)("produces a %s the API accepts", (kind) => {
    const result = pageSectionSchema.safeParse(defaultSection(kind));
    expect(result.success).toBe(true);
  });

  it("covers every content kind plus blockRef", () => {
    expect(SECTION_KINDS).toHaveLength(CONTENT_SECTION_KINDS.length + 1);
  });
});
