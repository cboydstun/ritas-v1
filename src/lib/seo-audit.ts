/**
 * SEO scoring for a blog post.
 *
 * Pure and synchronous, with **no zod and no mongoose import** — the same
 * discipline `src/lib/blog.ts` follows. The admin editor is a client component
 * and `/api/admin/blog-audit` is server-side, and both must run this exact
 * code: two implementations would let the live score and the saved-post score
 * disagree, which is worse than having no score at all.
 *
 * Everything here is advisory. Nothing in this module blocks a save, and
 * `hasDangerousHtml` in `@/lib/blog` remains the security-relevant check on a
 * post body — this file does not touch that responsibility.
 *
 * **HTML extraction is regex-based and approximate.** There is no parser
 * available at runtime (no cheerio, no jsdom, and `DOMParser` does not exist
 * on the server), so headings, anchors and images are matched by pattern.
 * Malformed or exotically nested markup will be mis-counted. That is an
 * acceptable trade for advisory scoring; it would not be for sanitisation.
 */
import { SLUG_PATTERN } from "@/lib/blog";

export type AuditSeverity = "error" | "warning" | "pass" | "skipped";

export type AuditGroup =
  "Title and Meta" | "Content and Structure" | "Links and Media" | "Technical";

export interface AuditCheck {
  id: string;
  group: AuditGroup;
  label: string;
  severity: AuditSeverity;
  /** What is wrong and why it matters, or why the check did not apply. */
  message: string;
  /** The measured figure, so the author can see the size of the gap. */
  value?: string | number;
}

export interface AuditReport {
  checks: AuditCheck[];
  /** 0-100 over applicable checks. `skipped` is excluded from the denominator. */
  score: number;
  errors: number;
  warnings: number;
}

export interface AuditInput {
  title?: string;
  seoTitle?: string;
  excerpt?: string;
  seoDescription?: string;
  slug?: string;
  body?: string;
  coverImagePath?: string;
  coverImageAlt?: string;
  focusKeyword?: string;
  status?: string;
  publishedAt?: string | Date | null;
  /**
   * Only `/api/admin/blog-audit` can supply this — it needs the other posts'
   * bodies. Absent means the duplicate check reports `skipped`, so the panel
   * renders the same list of checks either way.
   */
  duplicate?: { slug: string; similarity: number } | null;
}

/* -------------------------------------------------------------------------- */
/* Thresholds, named so the tests and the messages cannot drift apart.        */
/* -------------------------------------------------------------------------- */

export const TITLE_MAX = 60;
export const TITLE_MIN = 30;
export const DESCRIPTION_MAX = 160;
export const DESCRIPTION_MIN = 70;
export const SLUG_MAX_CHARS = 60;
export const SLUG_MAX_WORDS = 6;
export const CONTENT_MIN_WORDS = 300;
export const CONTENT_GOOD_WORDS = 600;
export const DENSITY_MIN = 0.5;
export const DENSITY_MAX = 2.5;
export const SENTENCE_MAX_WORDS = 25;
export const LONG_SENTENCE_WORDS = 30;
export const LONG_SENTENCE_SHARE_MAX = 25;
export const PARAGRAPH_MAX_WORDS = 150;
export const DUPLICATE_SIMILARITY_MAX = 0.3;
export const SHINGLE_SIZE = 5;

/* -------------------------------------------------------------------------- */
/* HTML extraction                                                            */
/* -------------------------------------------------------------------------- */

export interface ExtractedLink {
  href: string;
  /** The whole `<a …>` tag, so callers can look for `rel`. */
  tag: string;
}

export function extractHeadings(html: string): number[] {
  const levels: number[] = [];
  const pattern = /<\s*h([1-6])\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    levels.push(Number(match[1]));
  }
  return levels;
}

export function extractLinks(html: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const pattern = /<\s*a\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1];
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (href) links.push({ href: href[1], tag: match[0] });
  }
  return links;
}

export interface ExtractedImage {
  src: string;
  /** `undefined` when the attribute is absent entirely. */
  alt?: string;
}

export function extractImages(html: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const pattern = /<\s*img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attrs = match[1];
    const src = /src\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(attrs);
    images.push({ src: src ? src[1] : "", alt: alt ? alt[1] : undefined });
  }
  return images;
}

/** Tag-stripped, entity-collapsed plain text. */
export function toPlainText(html: string): string {
  return html
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Paragraph-ish blocks, for the readability metrics. */
export function extractParagraphs(html: string): string[] {
  const blocks = html.split(/<\s*\/\s*(?:p|div|li|h[1-6])\s*>/i);
  return blocks
    .map((block) => toPlainText(block))
    .filter((text) => text !== "");
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");
}

/* -------------------------------------------------------------------------- */
/* Duplicate detection                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Word n-grams of the normalised text.
 *
 * Shingling rather than a whole-document hash, so a post that copies most of
 * another and edits a few sentences still registers. Kept here rather than in
 * the route so it is unit-testable with no database.
 */
export function shingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const words = toPlainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const set = new Set<string>();
  if (words.length < size) {
    if (words.length > 0) set.add(words.join(" "));
    return set;
  }
  for (let i = 0; i <= words.length - size; i += 1) {
    set.add(words.slice(i, i + size).join(" "));
  }
  return set;
}

/** Jaccard similarity, 0 (disjoint) to 1 (identical). */
export function similarity(a: string, b: string): number {
  const left = shingles(a);
  const right = shingles(b);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const shingle of left) if (right.has(shingle)) intersection += 1;

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/* -------------------------------------------------------------------------- */
/* The audit                                                                  */
/* -------------------------------------------------------------------------- */

function normaliseKeyword(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Non-overlapping occurrences of a multi-word phrase. */
export function countOccurrences(haystack: string, needle: string): number {
  const key = normaliseKeyword(needle);
  if (key === "") return 0;

  const text = haystack.toLowerCase().replace(/\s+/g, " ");
  let count = 0;
  let index = text.indexOf(key);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(key, index + key.length);
  }
  return count;
}

export function auditPost(input: AuditInput): AuditReport {
  const checks: AuditCheck[] = [];
  const add = (check: AuditCheck) => checks.push(check);

  const body = input.body ?? "";
  const plain = toPlainText(body);
  const wordCount = countWords(plain);
  const keyword = normaliseKeyword(input.focusKeyword ?? "");
  const hasKeyword = keyword !== "";

  const effectiveTitle = (input.seoTitle || input.title || "").trim();
  const effectiveDescription = (
    input.seoDescription ||
    input.excerpt ||
    ""
  ).trim();

  /* ---------------------------- Title and Meta ---------------------------- */

  if (effectiveTitle === "") {
    add({
      id: "title-length",
      group: "Title and Meta",
      label: "Title tag length",
      severity: "error",
      message: "The post has no title.",
      value: 0,
    });
  } else if (effectiveTitle.length > TITLE_MAX) {
    add({
      id: "title-length",
      group: "Title and Meta",
      label: "Title tag length",
      severity: "error",
      message: `Google truncates around ${TITLE_MAX} characters, so the end of this title will not be shown.`,
      value: effectiveTitle.length,
    });
  } else if (effectiveTitle.length < TITLE_MIN) {
    add({
      id: "title-length",
      group: "Title and Meta",
      label: "Title tag length",
      severity: "warning",
      message: `Short titles leave room unused. Aim for ${TITLE_MIN}-${TITLE_MAX} characters.`,
      value: effectiveTitle.length,
    });
  } else {
    add({
      id: "title-length",
      group: "Title and Meta",
      label: "Title tag length",
      severity: "pass",
      message: `Fits within the ${TITLE_MAX}-character limit.`,
      value: effectiveTitle.length,
    });
  }

  if (effectiveDescription === "") {
    // Not a warning: `/blog/[slug]/page.tsx` feeds this one value to both
    // `openGraph.description` and the BlogPosting `description`, so leaving it
    // empty blanks the social card and the structured data together.
    add({
      id: "meta-description-length",
      group: "Title and Meta",
      label: "Meta description",
      severity: "error",
      message:
        "Empty. This field fills both the Open Graph description and the BlogPosting schema, so both go blank.",
      value: 0,
    });
  } else if (effectiveDescription.length > DESCRIPTION_MAX) {
    add({
      id: "meta-description-length",
      group: "Title and Meta",
      label: "Meta description",
      severity: "warning",
      message: `Over ${DESCRIPTION_MAX} characters is truncated in search results.`,
      value: effectiveDescription.length,
    });
  } else if (effectiveDescription.length < DESCRIPTION_MIN) {
    add({
      id: "meta-description-length",
      group: "Title and Meta",
      label: "Meta description",
      severity: "warning",
      message: `Under ${DESCRIPTION_MIN} characters wastes available space.`,
      value: effectiveDescription.length,
    });
  } else {
    add({
      id: "meta-description-length",
      group: "Title and Meta",
      label: "Meta description",
      severity: "pass",
      message: "A good length for the search snippet.",
      value: effectiveDescription.length,
    });
  }

  const slug = (input.slug ?? "").trim();
  const slugWords = slug === "" ? 0 : slug.split("-").length;
  if (slug === "" || !SLUG_PATTERN.test(slug)) {
    add({
      id: "slug-quality",
      group: "Title and Meta",
      label: "URL slug",
      severity: "error",
      message:
        "Must be lowercase words separated by single hyphens. Checkout rejects anything else.",
      value: slug,
    });
  } else if (slug.length > SLUG_MAX_CHARS || slugWords > SLUG_MAX_WORDS) {
    add({
      id: "slug-quality",
      group: "Title and Meta",
      label: "URL slug",
      severity: "warning",
      message: `Long slugs read poorly in results. Aim for under ${SLUG_MAX_WORDS} words and ${SLUG_MAX_CHARS} characters.`,
      value: `${slug.length} chars, ${slugWords} words`,
    });
  } else {
    add({
      id: "slug-quality",
      group: "Title and Meta",
      label: "URL slug",
      severity: "pass",
      message: "Short and clean.",
      value: `${slug.length} chars, ${slugWords} words`,
    });
  }

  const skipNoKeyword = "No focus keyword set, so this check does not apply.";

  add(
    !hasKeyword
      ? {
          id: "keyword-in-title",
          group: "Title and Meta",
          label: "Keyword in title",
          severity: "skipped",
          message: skipNoKeyword,
        }
      : countOccurrences(effectiveTitle, keyword) > 0
        ? {
            id: "keyword-in-title",
            group: "Title and Meta",
            label: "Keyword in title",
            severity: "pass",
            message: "The focus keyword appears in the title.",
          }
        : {
            id: "keyword-in-title",
            group: "Title and Meta",
            label: "Keyword in title",
            severity: "warning",
            message: "The focus keyword does not appear in the title.",
          },
  );

  add(
    !hasKeyword
      ? {
          id: "keyword-in-slug",
          group: "Title and Meta",
          label: "Keyword in slug",
          severity: "skipped",
          message: skipNoKeyword,
        }
      : slug.includes(keyword.replace(/\s+/g, "-"))
        ? {
            id: "keyword-in-slug",
            group: "Title and Meta",
            label: "Keyword in slug",
            severity: "pass",
            message: "The focus keyword appears in the slug.",
          }
        : {
            id: "keyword-in-slug",
            group: "Title and Meta",
            label: "Keyword in slug",
            severity: "warning",
            message: "The focus keyword does not appear in the slug.",
          },
  );

  /* ------------------------ Content and Structure ------------------------- */

  if (!hasKeyword) {
    add({
      id: "keyword-density",
      group: "Content and Structure",
      label: "Keyword density",
      severity: "skipped",
      message: skipNoKeyword,
    });
  } else if (wordCount === 0) {
    add({
      id: "keyword-density",
      group: "Content and Structure",
      label: "Keyword density",
      severity: "error",
      message: "There is no body text to measure.",
      value: 0,
    });
  } else {
    const occurrences = countOccurrences(plain, keyword);
    const density = (occurrences / wordCount) * 100;
    const rounded = Math.round(density * 100) / 100;
    add({
      id: "keyword-density",
      group: "Content and Structure",
      label: "Keyword density",
      severity:
        density < DENSITY_MIN || density > DENSITY_MAX ? "warning" : "pass",
      message:
        density > DENSITY_MAX
          ? `Above ${DENSITY_MAX}% reads as stuffing. Used ${occurrences} times in ${wordCount} words.`
          : density < DENSITY_MIN
            ? `Below ${DENSITY_MIN}%. Used ${occurrences} times in ${wordCount} words.`
            : `Used ${occurrences} times in ${wordCount} words.`,
      value: `${rounded}%`,
    });
  }

  const headings = extractHeadings(body);
  const h1Count = headings.filter((level) => level === 1).length;
  const h2Count = headings.filter((level) => level === 2).length;
  let skippedLevel = false;
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) skippedLevel = true;
  }

  if (h1Count > 0) {
    // The page already renders the post title as the page H1, so an authored
    // one is a second H1 on the same document.
    add({
      id: "heading-hierarchy",
      group: "Content and Structure",
      label: "Heading structure",
      severity: "error",
      message:
        "The body contains an H1. The page already renders the post title as the H1, so this is a second one — start the body at H2.",
      value: `${h1Count} H1`,
    });
  } else if (h2Count === 0) {
    add({
      id: "heading-hierarchy",
      group: "Content and Structure",
      label: "Heading structure",
      severity: "warning",
      message: "No H2 subheadings. Long posts need them to be scannable.",
      value: 0,
    });
  } else if (skippedLevel) {
    add({
      id: "heading-hierarchy",
      group: "Content and Structure",
      label: "Heading structure",
      severity: "warning",
      message: "A heading level is skipped (for example H2 straight to H4).",
      value: headings.join(", "),
    });
  } else {
    add({
      id: "heading-hierarchy",
      group: "Content and Structure",
      label: "Heading structure",
      severity: "pass",
      message: `${h2Count} H2 subheading${h2Count === 1 ? "" : "s"}, no level skipped.`,
      value: h2Count,
    });
  }

  add({
    id: "content-length",
    group: "Content and Structure",
    label: "Content length",
    severity:
      wordCount < CONTENT_MIN_WORDS
        ? "error"
        : wordCount < CONTENT_GOOD_WORDS
          ? "warning"
          : "pass",
    message:
      wordCount < CONTENT_MIN_WORDS
        ? `Under ${CONTENT_MIN_WORDS} words rarely ranks for anything competitive.`
        : wordCount < CONTENT_GOOD_WORDS
          ? `Reasonable, but ${CONTENT_GOOD_WORDS}+ words gives more to rank on.`
          : "Enough depth to rank on.",
    value: `${wordCount} words`,
  });

  const sentences = splitSentences(plain);
  const paragraphs = extractParagraphs(body);
  if (wordCount === 0) {
    add({
      id: "readability",
      group: "Content and Structure",
      label: "Readability",
      severity: "skipped",
      message: "There is no body text to measure.",
    });
  } else {
    const avgSentence = wordCount / Math.max(1, sentences.length);
    const longSentences = sentences.filter(
      (sentence) => countWords(sentence) > LONG_SENTENCE_WORDS,
    ).length;
    const longShare = (longSentences / Math.max(1, sentences.length)) * 100;
    const avgParagraph = wordCount / Math.max(1, paragraphs.length);

    const problems: string[] = [];
    if (avgSentence > SENTENCE_MAX_WORDS)
      problems.push(`sentences average ${Math.round(avgSentence)} words`);
    if (longShare > LONG_SENTENCE_SHARE_MAX)
      problems.push(`${Math.round(longShare)}% of sentences run long`);
    if (avgParagraph > PARAGRAPH_MAX_WORDS)
      problems.push(`paragraphs average ${Math.round(avgParagraph)} words`);

    add({
      id: "readability",
      group: "Content and Structure",
      label: "Readability",
      severity: problems.length > 0 ? "warning" : "pass",
      // These are structural proxies, not a Flesch grade — no syllable
      // counting is involved, and they are approximate by design.
      message:
        problems.length > 0
          ? `Hard going: ${problems.join("; ")}.`
          : "Sentence and paragraph lengths are comfortable.",
      value: `${Math.round(avgSentence)} words/sentence`,
    });
  }

  if (input.duplicate === undefined) {
    add({
      id: "duplicate-content",
      group: "Content and Structure",
      label: "Duplicate content",
      severity: "skipped",
      message: 'Not checked yet — use "Check for duplicates".',
    });
  } else if (input.duplicate === null) {
    add({
      id: "duplicate-content",
      group: "Content and Structure",
      label: "Duplicate content",
      severity: "pass",
      message:
        "No overlap with another post on this site. Off-site duplication is not checked.",
    });
  } else {
    const percent = Math.round(input.duplicate.similarity * 100);
    add({
      id: "duplicate-content",
      group: "Content and Structure",
      label: "Duplicate content",
      severity:
        input.duplicate.similarity > DUPLICATE_SIMILARITY_MAX
          ? "warning"
          : "pass",
      message:
        input.duplicate.similarity > DUPLICATE_SIMILARITY_MAX
          ? `Overlaps "${input.duplicate.slug}". Two posts competing for the same terms split their own ranking.`
          : `Closest post is "${input.duplicate.slug}", which is far enough away.`,
      value: `${percent}%`,
    });
  }

  /* ---------------------------- Links and Media --------------------------- */

  const links = extractLinks(body);
  const internal = links.filter((link) => link.href.startsWith("/"));
  const external = links.filter((link) => /^https?:\/\//i.test(link.href));

  add({
    id: "internal-links",
    group: "Links and Media",
    label: "Internal links",
    severity: internal.length === 0 ? "warning" : "pass",
    message:
      internal.length === 0
        ? "No links to your own pages. Internal links pass authority and keep readers on the site."
        : `${internal.length} link${internal.length === 1 ? "" : "s"} to other pages here.`,
    value: internal.length,
  });

  const externalMissingRel = external.filter(
    (link) => !/\brel\s*=/i.test(link.tag),
  ).length;

  add({
    id: "external-links",
    group: "Links and Media",
    label: "External links",
    severity:
      external.length === 0
        ? "warning"
        : externalMissingRel > 0
          ? "warning"
          : "pass",
    message:
      external.length === 0
        ? "No outbound links. Citing trusted sources is a quality signal."
        : externalMissingRel > 0
          ? `${externalMissingRel} outbound link${externalMissingRel === 1 ? "" : "s"} without a rel attribute.`
          : `${external.length} outbound link${external.length === 1 ? "" : "s"}, all carrying rel.`,
    value: external.length,
  });

  const images = extractImages(body);
  const missingAlt = images.filter(
    (image) => image.alt === undefined || image.alt.trim() === "",
  ).length;
  const coverMissingAlt =
    (input.coverImagePath ?? "").trim() !== "" &&
    (input.coverImageAlt ?? "").trim() === "";

  add({
    id: "image-alt-text",
    group: "Links and Media",
    label: "Image alt text",
    severity: missingAlt > 0 || coverMissingAlt ? "error" : "pass",
    message:
      missingAlt > 0 || coverMissingAlt
        ? [
            missingAlt > 0
              ? `${missingAlt} body image${missingAlt === 1 ? "" : "s"} without alt text`
              : "",
            coverMissingAlt ? "the cover image has no alt text" : "",
          ]
            .filter(Boolean)
            .join(" and ") + ". Screen readers and image search both need it."
        : images.length === 0
          ? "No images to check."
          : `All ${images.length} image${images.length === 1 ? "" : "s"} have alt text.`,
    value: images.length,
  });

  /* ------------------------------- Technical ------------------------------ */

  const hasCover = (input.coverImagePath ?? "").trim() !== "";

  add({
    id: "open-graph",
    group: "Technical",
    label: "Open Graph tags",
    severity: hasCover && effectiveDescription !== "" ? "pass" : "warning",
    // The page always emits the tags; what varies per post is whether they
    // carry anything specific. Without a cover image every post shares the
    // generic /og-image.jpg.
    message:
      !hasCover && effectiveDescription === ""
        ? "No cover image and no description, so the social card falls back to the generic site image with no text."
        : !hasCover
          ? "No cover image, so the social card uses the generic /og-image.jpg shared by every post."
          : effectiveDescription === ""
            ? "No description for the social card."
            : "Post-specific image and description.",
  });

  const hasPublishedAt = Boolean(input.publishedAt);
  const schemaGaps: string[] = [];
  if (effectiveDescription === "") schemaGaps.push("description");
  if (!hasCover) schemaGaps.push("image");
  if (input.status === "published" && !hasPublishedAt)
    schemaGaps.push("datePublished");

  add({
    id: "schema-markup",
    group: "Technical",
    label: "Schema markup",
    severity: schemaGaps.length > 0 ? "warning" : "pass",
    message:
      schemaGaps.length > 0
        ? `The BlogPosting node is emitted but incomplete: ${schemaGaps.join(", ")} missing.`
        : "The BlogPosting node is fully populated.",
  });

  add({
    id: "sitemap-inclusion",
    group: "Technical",
    label: "XML sitemap",
    severity: input.status === "published" ? "pass" : "skipped",
    message:
      input.status === "published"
        ? "Published, so sitemap.ts includes this URL."
        : "Drafts are deliberately kept out of the sitemap. Publish to include it.",
  });

  /* -------------------------------- Score --------------------------------- */

  const applicable = checks.filter((check) => check.severity !== "skipped");
  const passes = applicable.filter((check) => check.severity === "pass").length;

  return {
    checks,
    score:
      applicable.length === 0
        ? 0
        : Math.round((passes / applicable.length) * 100),
    errors: checks.filter((check) => check.severity === "error").length,
    warnings: checks.filter((check) => check.severity === "warning").length,
  };
}
