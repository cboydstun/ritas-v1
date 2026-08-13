/**
 * @jest-environment node
 */
import {
  CONTENT_MIN_WORDS,
  DESCRIPTION_MIN,
  TITLE_MAX,
  TITLE_MIN,
  auditPost,
  countOccurrences,
  countWords,
  extractHeadings,
  extractImages,
  extractLinks,
  extractParagraphs,
  shingles,
  similarity,
  splitSentences,
  toPlainText,
  type AuditInput,
  type AuditReport,
  type AuditSeverity,
} from "@/lib/seo-audit";

/** Body long enough to clear the content-length floor, so other checks can be
 *  tested without that error dominating every report. */
const longBody = (extra = "") =>
  `<h2>Heading</h2><p>${"word ".repeat(CONTENT_GOOD)}</p>${extra}`;
const CONTENT_GOOD = 650;

const validInput = (overrides: Partial<AuditInput> = {}): AuditInput => ({
  title: "How margarita machine delivery works in San Antonio",
  excerpt:
    "What happens on the day of your rental, from the delivery window through pickup the next morning.",
  slug: "how-delivery-works",
  body: longBody(
    '<p><a href="/order">Book</a> <a href="https://example.com" rel="noopener">source</a></p>',
  ),
  coverImagePath: "/images/blog/delivery.jpg",
  coverImageAlt: "A machine being unloaded",
  status: "published",
  publishedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

function check(report: AuditReport, id: string) {
  const found = report.checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check with id ${id}`);
  return found;
}

const severityOf = (input: AuditInput, id: string): AuditSeverity =>
  check(auditPost(input), id).severity;

describe("HTML extraction", () => {
  it("pulls heading levels in document order", () => {
    expect(extractHeadings("<h2>a</h2><h3>b</h3><h2>c</h2>")).toEqual([
      2, 3, 2,
    ]);
  });

  it("reads href and the whole tag from anchors", () => {
    const links = extractLinks('<a href="/order" rel="x">Book</a>');
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("/order");
    expect(links[0].tag).toContain("rel=");
  });

  it("distinguishes a missing alt from an empty one", () => {
    const images = extractImages('<img src="/a.jpg"><img src="/b.jpg" alt="">');
    expect(images[0].alt).toBeUndefined();
    expect(images[1].alt).toBe("");
  });

  it("strips tags and script contents from the plain text", () => {
    expect(
      toPlainText("<p>Hello <b>there</b></p><script>evil()</script>"),
    ).toBe("Hello there");
  });

  it("counts words, treating empty as zero", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one two three")).toBe(3);
  });

  it("splits sentences on terminal punctuation", () => {
    expect(splitSentences("One. Two! Three?")).toHaveLength(3);
  });

  it("splits paragraphs on block-closing tags", () => {
    expect(extractParagraphs("<p>one</p><p>two</p>")).toEqual(["one", "two"]);
  });
});

describe("countOccurrences", () => {
  it("counts a multi-word phrase case-insensitively", () => {
    expect(
      countOccurrences(
        "Margarita Machine and margarita machine",
        "margarita machine",
      ),
    ).toBe(2);
  });

  it("does not count overlapping matches twice", () => {
    expect(countOccurrences("aaaa", "aa")).toBe(2);
  });

  it("returns zero for an empty needle", () => {
    expect(countOccurrences("anything", "")).toBe(0);
  });
});

describe("similarity", () => {
  it("scores identical text as 1", () => {
    const text = "the quick brown fox jumps over the lazy dog again and again";
    expect(similarity(text, text)).toBe(1);
  });

  it("scores disjoint text as 0", () => {
    expect(
      similarity(
        "alpha beta gamma delta epsilon zeta",
        "one two three four five six",
      ),
    ).toBe(0);
  });

  it("scores partial overlap between 0 and 1", () => {
    const score = similarity(
      "the quick brown fox jumps over the lazy dog",
      "the quick brown fox jumps over a sleeping cat",
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("treats an empty side as no overlap", () => {
    expect(similarity("some words here at all", "")).toBe(0);
  });

  // Below the shingle size there are no n-grams, so short texts fall back to
  // the whole string rather than silently scoring 0 against everything.
  it("still compares texts shorter than the shingle size", () => {
    expect(similarity("two words", "two words")).toBe(1);
    expect(shingles("two words").size).toBe(1);
  });
});

describe("title-length", () => {
  it("errors when there is no title", () => {
    expect(
      severityOf(validInput({ title: "", seoTitle: "" }), "title-length"),
    ).toBe("error");
  });

  it(`errors above ${TITLE_MAX} characters`, () => {
    expect(
      severityOf(
        validInput({ title: "a".repeat(TITLE_MAX + 1) }),
        "title-length",
      ),
    ).toBe("error");
  });

  it(`passes exactly at ${TITLE_MAX}`, () => {
    expect(
      severityOf(validInput({ title: "a".repeat(TITLE_MAX) }), "title-length"),
    ).toBe("pass");
  });

  it(`warns below ${TITLE_MIN}`, () => {
    expect(
      severityOf(
        validInput({ title: "a".repeat(TITLE_MIN - 1) }),
        "title-length",
      ),
    ).toBe("warning");
  });

  it("prefers seoTitle over title", () => {
    const report = auditPost(
      validInput({ title: "short", seoTitle: "a".repeat(TITLE_MAX + 1) }),
    );
    expect(check(report, "title-length").severity).toBe("error");
  });
});

describe("meta-description-length", () => {
  // Errors rather than warns: this one value feeds both the Open Graph
  // description and the BlogPosting schema.
  it("errors when empty", () => {
    expect(
      severityOf(
        validInput({ excerpt: "", seoDescription: "" }),
        "meta-description-length",
      ),
    ).toBe("error");
  });

  it("warns when too short", () => {
    expect(
      severityOf(
        validInput({ excerpt: "a".repeat(DESCRIPTION_MIN - 1) }),
        "meta-description-length",
      ),
    ).toBe("warning");
  });

  it("warns when too long", () => {
    expect(
      severityOf(
        validInput({ excerpt: "a".repeat(200) }),
        "meta-description-length",
      ),
    ).toBe("warning");
  });

  it("passes in the band", () => {
    expect(severityOf(validInput(), "meta-description-length")).toBe("pass");
  });
});

describe("slug-quality", () => {
  it.each(["Not A Slug", "trailing-", "double--hyphen", ""])(
    "errors on %s",
    (slug) => {
      expect(severityOf(validInput({ slug }), "slug-quality")).toBe("error");
    },
  );

  it("warns on a slug with too many words", () => {
    expect(
      severityOf(
        validInput({ slug: "one-two-three-four-five-six-seven" }),
        "slug-quality",
      ),
    ).toBe("warning");
  });

  it("passes a short clean slug", () => {
    expect(severityOf(validInput(), "slug-quality")).toBe("pass");
  });
});

describe("keyword checks", () => {
  it("skips all three when no focus keyword is set", () => {
    const report = auditPost(validInput());
    for (const id of [
      "keyword-in-title",
      "keyword-in-slug",
      "keyword-density",
    ]) {
      expect(check(report, id).severity).toBe("skipped");
    }
  });

  it("passes when the keyword is in the title and slug", () => {
    const report = auditPost(
      validInput({
        title: "Margarita machine delivery in San Antonio explained",
        slug: "margarita-machine-delivery",
        focusKeyword: "margarita machine",
      }),
    );
    expect(check(report, "keyword-in-title").severity).toBe("pass");
    expect(check(report, "keyword-in-slug").severity).toBe("pass");
  });

  it("warns when the keyword is absent from the title", () => {
    expect(
      severityOf(
        validInput({ focusKeyword: "frozen daiquiri" }),
        "keyword-in-title",
      ),
    ).toBe("warning");
  });

  it("warns when density is below the floor", () => {
    expect(
      severityOf(
        validInput({ focusKeyword: "frozen daiquiri" }),
        "keyword-density",
      ),
    ).toBe("warning");
  });

  it("warns when density is above the ceiling", () => {
    const stuffed = `<h2>x</h2><p>${"margarita machine ".repeat(60)}</p>`;
    expect(
      severityOf(
        validInput({ body: stuffed, focusKeyword: "margarita machine" }),
        "keyword-density",
      ),
    ).toBe("warning");
  });
});

describe("heading-hierarchy", () => {
  // The page renders the post title as the page H1, so an authored H1 is a
  // second one on the same document.
  it("errors on an H1 in the body", () => {
    expect(
      severityOf(
        validInput({ body: longBody("<h1>Second H1</h1>") }),
        "heading-hierarchy",
      ),
    ).toBe("error");
  });

  it("warns when there are no H2s", () => {
    expect(
      severityOf(
        validInput({ body: `<p>${"word ".repeat(650)}</p>` }),
        "heading-hierarchy",
      ),
    ).toBe("warning");
  });

  it("warns when a level is skipped", () => {
    expect(
      severityOf(
        validInput({
          body: `<h2>a</h2><h4>b</h4><p>${"word ".repeat(650)}</p>`,
        }),
        "heading-hierarchy",
      ),
    ).toBe("warning");
  });

  it("passes a clean H2/H3 structure", () => {
    expect(
      severityOf(
        validInput({
          body: `<h2>a</h2><h3>b</h3><p>${"word ".repeat(650)}</p>`,
        }),
        "heading-hierarchy",
      ),
    ).toBe("pass");
  });
});

describe("content-length", () => {
  it("errors below the floor", () => {
    expect(
      severityOf(
        validInput({ body: "<h2>a</h2><p>too short</p>" }),
        "content-length",
      ),
    ).toBe("error");
  });

  it("warns between the floor and the target", () => {
    expect(
      severityOf(
        validInput({
          body: `<h2>a</h2><p>${"word ".repeat(CONTENT_MIN_WORDS + 50)}</p>`,
        }),
        "content-length",
      ),
    ).toBe("warning");
  });

  it("passes above the target", () => {
    expect(severityOf(validInput(), "content-length")).toBe("pass");
  });
});

describe("readability", () => {
  it("skips when there is no body", () => {
    expect(severityOf(validInput({ body: "" }), "readability")).toBe("skipped");
  });

  it("warns on very long sentences", () => {
    const rambling = `<h2>a</h2><p>${`${"word ".repeat(60)}. `.repeat(12)}</p>`;
    expect(severityOf(validInput({ body: rambling }), "readability")).toBe(
      "warning",
    );
  });

  it("passes on short sentences in short paragraphs", () => {
    const easy = `<h2>a</h2>${"<p>This is a short sentence about drinks. It stays brief.</p>".repeat(70)}`;
    expect(severityOf(validInput({ body: easy }), "readability")).toBe("pass");
  });
});

describe("duplicate-content", () => {
  it("is skipped when the server has not been asked", () => {
    expect(severityOf(validInput(), "duplicate-content")).toBe("skipped");
  });

  it("passes when the server found nothing", () => {
    expect(
      severityOf(validInput({ duplicate: null }), "duplicate-content"),
    ).toBe("pass");
  });

  it("warns above the similarity threshold", () => {
    expect(
      severityOf(
        validInput({ duplicate: { slug: "other", similarity: 0.8 } }),
        "duplicate-content",
      ),
    ).toBe("warning");
  });

  it("passes below the similarity threshold", () => {
    expect(
      severityOf(
        validInput({ duplicate: { slug: "other", similarity: 0.05 } }),
        "duplicate-content",
      ),
    ).toBe("pass");
  });
});

describe("links", () => {
  it("warns with no internal links", () => {
    expect(severityOf(validInput({ body: longBody() }), "internal-links")).toBe(
      "warning",
    );
  });

  it("warns with no external links", () => {
    expect(
      severityOf(
        validInput({ body: longBody('<a href="/order">Book</a>') }),
        "external-links",
      ),
    ).toBe("warning");
  });

  it("warns when an external link has no rel", () => {
    expect(
      severityOf(
        validInput({
          body: longBody('<a href="/x">a</a><a href="https://e.com">b</a>'),
        }),
        "external-links",
      ),
    ).toBe("warning");
  });

  it("passes when both kinds are present and rel is set", () => {
    const report = auditPost(validInput());
    expect(check(report, "internal-links").severity).toBe("pass");
    expect(check(report, "external-links").severity).toBe("pass");
  });
});

describe("image-alt-text", () => {
  it("errors on a body image with no alt attribute", () => {
    expect(
      severityOf(
        validInput({ body: longBody('<img src="/a.jpg">') }),
        "image-alt-text",
      ),
    ).toBe("error");
  });

  it("errors on an empty alt", () => {
    expect(
      severityOf(
        validInput({ body: longBody('<img src="/a.jpg" alt="  ">') }),
        "image-alt-text",
      ),
    ).toBe("error");
  });

  it("errors when the cover image has no alt text", () => {
    expect(
      severityOf(validInput({ coverImageAlt: "" }), "image-alt-text"),
    ).toBe("error");
  });

  it("passes when every image is described", () => {
    expect(
      severityOf(
        validInput({ body: longBody('<img src="/a.jpg" alt="A machine">') }),
        "image-alt-text",
      ),
    ).toBe("pass");
  });
});

describe("technical checks", () => {
  it("warns on Open Graph when there is no cover image", () => {
    expect(
      severityOf(
        validInput({ coverImagePath: "", coverImageAlt: "" }),
        "open-graph",
      ),
    ).toBe("warning");
  });

  it("passes Open Graph with a cover image and a description", () => {
    expect(severityOf(validInput(), "open-graph")).toBe("pass");
  });

  it("warns on schema when the description is missing", () => {
    expect(
      severityOf(
        validInput({ excerpt: "", seoDescription: "" }),
        "schema-markup",
      ),
    ).toBe("warning");
  });

  it("warns on schema when a published post has no publishedAt", () => {
    expect(
      severityOf(
        validInput({ status: "published", publishedAt: null }),
        "schema-markup",
      ),
    ).toBe("warning");
  });

  it("passes schema when everything is populated", () => {
    expect(severityOf(validInput(), "schema-markup")).toBe("pass");
  });

  it("passes sitemap inclusion when published", () => {
    expect(severityOf(validInput(), "sitemap-inclusion")).toBe("pass");
  });

  it("skips sitemap inclusion for a draft", () => {
    expect(
      severityOf(validInput({ status: "draft" }), "sitemap-inclusion"),
    ).toBe("skipped");
  });
});

describe("scoring", () => {
  it("excludes skipped checks from the denominator", () => {
    const report = auditPost(validInput());
    const applicable = report.checks.filter((c) => c.severity !== "skipped");
    const passes = applicable.filter((c) => c.severity === "pass").length;

    expect(report.score).toBe(Math.round((passes / applicable.length) * 100));
    expect(applicable.length).toBeLessThan(report.checks.length);
  });

  it("counts errors and warnings", () => {
    const report = auditPost(validInput({ body: longBody("<h1>bad</h1>") }));
    expect(report.errors).toBeGreaterThan(0);
    expect(report.errors).toBe(
      report.checks.filter((c) => c.severity === "error").length,
    );
  });

  it("scores a well-formed post highly", () => {
    const report = auditPost(
      validInput({
        focusKeyword: "margarita machine",
        title: "Margarita machine delivery in San Antonio explained",
        slug: "margarita-machine-delivery",
        body: `<h2>On the day</h2><p>${"margarita machine word word word word word word word ".repeat(40)}</p><p><a href="/order">Book</a> <a href="https://example.com" rel="noopener">source</a></p>`,
        duplicate: null,
      }),
    );
    expect(report.errors).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it("returns every check regardless of input, so the panel never reflows", () => {
    const empty = auditPost({});
    const full = auditPost(validInput({ focusKeyword: "x", duplicate: null }));
    expect(empty.checks.map((c) => c.id).sort()).toEqual(
      full.checks.map((c) => c.id).sort(),
    );
  });
});
