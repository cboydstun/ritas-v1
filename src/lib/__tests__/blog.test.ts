/**
 * @jest-environment node
 */
import {
  MAX_SLUG_LENGTH,
  SLUG_PATTERN,
  hasDangerousHtml,
  isBlogStatus,
  isSafeCoverImagePath,
  slugify,
} from "@/lib/blog";

describe("slugify", () => {
  it("lowercases and hyphenates a title", () => {
    expect(slugify("Frozen Margarita Machine Rental")).toBe(
      "frozen-margarita-machine-rental",
    );
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Piña Colada Días")).toBe("pina-colada-dias");
  });

  it("collapses punctuation runs into a single hyphen", () => {
    expect(slugify("Weddings, Quinceañeras & More!!!")).toBe(
      "weddings-quinceaneras-more",
    );
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
  });

  it("produces a slug that satisfies SLUG_PATTERN", () => {
    for (const title of [
      "A Guide to 3 Machines",
      "¿Qué tal? — the 2026 season",
      "Trailing punctuation!!!",
    ]) {
      expect(SLUG_PATTERN.test(slugify(title))).toBe(true);
    }
  });

  // Truncating after the hyphen-trim would leave a trailing hyphen, which
  // SLUG_PATTERN rejects — the slug would round-trip into an invalid value.
  it("does not leave a trailing hyphen when it truncates", () => {
    const slug = slugify("word ".repeat(60));
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });
});

describe("SLUG_PATTERN", () => {
  it.each(["hello", "hello-world", "a1-b2-c3"])("accepts %s", (slug) => {
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });

  it.each([
    "-leading",
    "trailing-",
    "double--hyphen",
    "Upper",
    "has space",
    "",
  ])("rejects %s", (slug) => {
    expect(SLUG_PATTERN.test(slug)).toBe(false);
  });
});

describe("isBlogStatus", () => {
  it("accepts the two real statuses", () => {
    expect(isBlogStatus("draft")).toBe(true);
    expect(isBlogStatus("published")).toBe(true);
  });

  it.each([["archived"], [null], [undefined], [1]])(
    "rejects %p",
    (value: unknown) => {
      expect(isBlogStatus(value)).toBe(false);
    },
  );
});

describe("isSafeCoverImagePath", () => {
  it("accepts a site-relative path", () => {
    expect(isSafeCoverImagePath("/images/blog/frozen.jpg")).toBe(true);
  });

  // A protocol-relative URL resolves to a remote origin in the browser, which
  // would need a remotePatterns entry and a CSP img-src host this app
  // deliberately does not have.
  it("rejects a protocol-relative URL", () => {
    expect(isSafeCoverImagePath("//evil.example.com/x.jpg")).toBe(false);
  });

  it.each([
    "https://example.com/x.jpg",
    "images/x.jpg",
    "/images/../../etc/passwd",
    "/images\\x.jpg",
    "javascript:alert(1)",
  ])("rejects %s", (value) => {
    expect(isSafeCoverImagePath(value)).toBe(false);
  });

  it("rejects a path carrying a control character", () => {
    expect(isSafeCoverImagePath("/images/x\u0000.jpg")).toBe(false);
  });
});

describe("hasDangerousHtml", () => {
  it.each([
    "<script>alert(1)</script>",
    "<SCRIPT src=x></SCRIPT>",
    "<iframe src=/x></iframe>",
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    "<form action=/x></form>",
  ])("flags %s", (value) => {
    expect(hasDangerousHtml(value)).toBe(true);
  });

  it("passes ordinary post markup", () => {
    expect(
      hasDangerousHtml(
        "<h2>Flavours</h2><p>We deliver <strong>frozen</strong> drinks. " +
          '<a href="/order">Book now</a>.</p><ul><li>Margarita</li></ul>',
      ),
    ).toBe(false);
  });

  // An unanchored /\son[a-z]+=/ matched prose, and an unanchored /data:/
  // matched the word "data:" in a sentence. Either false positive is a save
  // the admin cannot complete and cannot explain.
  it("does not flag prose that merely reads like an attribute", () => {
    expect(
      hasDangerousHtml("<p>Switch it on x=1 for the data: it works.</p>"),
    ).toBe(false);
  });
});
