/**
 * SEO scoring for a landing page.
 *
 * The landing-page counterpart to `src/lib/seo-audit.ts`, and it deliberately
 * **imports from it** rather than restating anything: the check shape, the
 * report shape, every threshold and every HTML extractor come from there. Two
 * copies of `TITLE_MAX` would eventually disagree, and a blog score and a
 * landing score that were computed differently could not be compared at all.
 *
 * Pure, synchronous, **zod-free and mongoose-free** — the same discipline
 * `src/lib/landing.ts` keeps — because the admin editor is a client component
 * and `/api/admin/landing-audit` is server-side, and both run this exact code.
 *
 * Everything here is advisory. Nothing blocks a save, and `hasDangerousHtml`
 * in `@/lib/blog` remains the security-relevant check on authored rich text —
 * this file does not touch that responsibility.
 *
 * The awkward part of the job is that a landing page is **structured sections,
 * not a document**. `sectionsToHtml` renders a synthetic approximation of the
 * page so the `seo-audit` extractors work unchanged; the structural checks
 * read the section array directly instead.
 */
import {
  MAX_PATH_SEGMENTS,
  isLandingPath,
  isReservedPath,
  landingPathToSegments,
  type Breadcrumb,
  type CtaLink,
  type LandingSection,
} from "@/lib/landing";
import { getServiceArea } from "@/lib/service-areas";
import {
  CONTENT_GOOD_WORDS,
  CONTENT_MIN_WORDS,
  DENSITY_MAX,
  DENSITY_MIN,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  DUPLICATE_SIMILARITY_MAX,
  LONG_SENTENCE_SHARE_MAX,
  LONG_SENTENCE_WORDS,
  PARAGRAPH_MAX_WORDS,
  SENTENCE_MAX_WORDS,
  SLUG_MAX_CHARS,
  SLUG_MAX_WORDS,
  TITLE_MAX,
  TITLE_MIN,
  countOccurrences,
  countWords,
  extractHeadings,
  extractImages,
  extractLinks,
  extractParagraphs,
  splitSentences,
  summariseChecks,
  toPlainText,
  type AuditCheck,
  type AuditReport,
} from "@/lib/seo-audit";

/**
 * The facts an audit cannot learn from the draft in front of the admin.
 *
 * Supplied only by `/api/admin/landing-audit`. Absent means those checks
 * report `skipped`, so the panel renders the same list of rows either way.
 */
export interface LandingCrossPageFacts {
  /** The closest other landing page by Jaccard similarity, or null. */
  duplicate: { path: string; similarity: number } | null;
  /** The path of another page already using this title tag, if any. */
  titleCollision: string | null;
  /** The path of another page already using this meta description, if any. */
  descriptionCollision: string | null;
  publishedPaths: string[];
  publishedBlockSlugs: string[];
}

export interface LandingAuditInput {
  path?: string;
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImagePath?: string;
  focusKeyword?: string;
  schemaType?: string;
  serviceAreaName?: string;
  breadcrumbs?: Breadcrumb[];
  sections?: LandingSection[];
  status?: string;
  crossPage?: LandingCrossPageFacts;
}

/** A path this deep with no breadcrumb trail is a page with no way up. */
export const BREADCRUMB_MIN_DEPTH = 2;

/* -------------------------------------------------------------------------- */
/* Sections to a synthetic document                                           */
/* -------------------------------------------------------------------------- */

function escapeAttribute(value: string): string {
  return value.replace(/"/g, "&quot;");
}

function anchor(link: CtaLink | undefined): string {
  if (!link || !link.href) return "";
  return `<a href="${escapeAttribute(link.href)}">${link.label ?? ""}</a>`;
}

/**
 * A landing page as the HTML it approximately renders to.
 *
 * The heading levels are the contract that matters: `SectionRenderer` renders
 * a hero's heading as the page's H1 and every other section heading as an H2,
 * so `heading-structure` can be a real check rather than a guess.
 *
 * `pricingCards` and `nearbyAreas` contribute only their heading on purpose —
 * they store no content and resolve their bodies at render time, from
 * `Settings` and from `SERVICE_AREAS` respectively. Flattening what they
 * *would* render into this string would make the word count depend on data
 * the editor does not have.
 */
export function sectionsToHtml(sections: LandingSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    switch (section.kind) {
      case "hero":
        if (section.eyebrow) parts.push(`<p>${section.eyebrow}</p>`);
        parts.push(`<h1>${section.heading ?? ""}</h1>`);
        if (section.body) parts.push(`<p>${section.body}</p>`);
        parts.push(anchor(section.primaryCta), anchor(section.secondaryCta));
        break;

      case "richText":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        // Verbatim: its own headings, links and images are exactly what the
        // extractors need to see.
        parts.push(section.html ?? "");
        break;

      case "features":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        if (section.intro) parts.push(`<p>${section.intro}</p>`);
        for (const item of section.items ?? []) {
          if (item.title) parts.push(`<h3>${item.title}</h3>`);
          parts.push(`<p>${item.body ?? ""}</p>`);
        }
        break;

      case "faq":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        for (const item of section.items ?? []) {
          parts.push(`<h3>${item.question ?? ""}</h3>`);
          parts.push(`<p>${item.answer ?? ""}</p>`);
        }
        break;

      case "cta":
        if (section.headline) parts.push(`<h2>${section.headline}</h2>`);
        if (section.subtext) parts.push(`<p>${section.subtext}</p>`);
        break;

      case "linkList":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        for (const item of section.items ?? []) parts.push(anchor(item));
        parts.push(anchor(section.footerLink));
        break;

      case "nearbyAreas":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        parts.push(anchor(section.footerLink));
        break;

      case "pricingCards":
        if (section.heading) parts.push(`<h2>${section.heading}</h2>`);
        break;

      case "blockRef":
        // Its content lives in another document the editor has not loaded.
        // Counting it here would make the score depend on an unresolved read.
        break;
    }
  }

  return parts.filter(Boolean).join("\n");
}

/* -------------------------------------------------------------------------- */
/* Link targets                                                               */
/* -------------------------------------------------------------------------- */

/** Strips a fragment and query, so `/pricing#tiers` resolves to `/pricing`. */
function linkPath(href: string): string {
  return href.split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
}

/**
 * Whether a site-relative href points at something that answers.
 *
 * A reserved path is a real route file, so it is fine by definition — that
 * includes every `/blog/…` and `/order` URL. Anything else has to be a
 * published landing page, because the catch-all is what would serve it.
 */
function isResolvableTarget(href: string, publishedPaths: string[]): boolean {
  const path = linkPath(href);
  if (isReservedPath(path)) return true;
  return publishedPaths.includes(path);
}

/* -------------------------------------------------------------------------- */
/* The audit                                                                  */
/* -------------------------------------------------------------------------- */

function isKind<K extends LandingSection["kind"]>(
  section: LandingSection,
  kind: K,
): section is Extract<LandingSection, { kind: K }> {
  return section.kind === kind;
}

export function auditLandingPage(input: LandingAuditInput): AuditReport {
  const checks: AuditCheck[] = [];
  const add = (check: AuditCheck) => checks.push(check);

  const sections = input.sections ?? [];
  const html = sectionsToHtml(sections);
  const plain = toPlainText(html);
  const wordCount = countWords(plain);
  const keyword = (input.focusKeyword ?? "").trim();
  const path = (input.path ?? "").trim();
  const cross = input.crossPage;

  // The title tag falls back to `title`; the description has no fallback at
  // all, which is the single most consequential fact in `generateMetadata`.
  const effectiveTitle = (input.seoTitle || input.title || "").trim();
  const description = (input.seoDescription ?? "").trim();

  const heroes = sections.filter((section) => isKind(section, "hero"));
  const faqItems = sections
    .filter((section) => isKind(section, "faq"))
    .flatMap((section) => section.items ?? []);
  const hasPricingCards = sections.some((section) =>
    isKind(section, "pricingCards"),
  );

  /* ---------------------------- Title and Meta ---------------------------- */

  add({
    id: "title-length",
    group: "Title and Meta",
    label: "Title tag length",
    severity:
      effectiveTitle === "" || effectiveTitle.length > TITLE_MAX
        ? "error"
        : effectiveTitle.length < TITLE_MIN
          ? "warning"
          : "pass",
    message:
      effectiveTitle === ""
        ? "There is no title. Fill in the title, or an SEO title to override it."
        : effectiveTitle.length > TITLE_MAX
          ? `Google truncates around ${TITLE_MAX} characters, so the tail is not shown.`
          : effectiveTitle.length < TITLE_MIN
            ? `Under ${TITLE_MIN} characters leaves room a competing result will use.`
            : "A good length for the search result.",
    value: effectiveTitle.length,
  });

  add({
    id: "meta-description-length",
    group: "Title and Meta",
    label: "Meta description",
    severity:
      description === ""
        ? "error"
        : description.length > DESCRIPTION_MAX ||
            description.length < DESCRIPTION_MIN
          ? "warning"
          : "pass",
    message:
      description === ""
        ? "Empty. Unlike the blog, a landing page has no excerpt to fall back on — the page ships a blank meta description and a blank og:description."
        : description.length > DESCRIPTION_MAX
          ? `Google truncates around ${DESCRIPTION_MAX} characters.`
          : description.length < DESCRIPTION_MIN
            ? `Under ${DESCRIPTION_MIN} characters wastes the snippet.`
            : "A good length for the snippet.",
    value: description.length,
  });

  const segments = path ? landingPathToSegments(path) : [];
  const lastSegment = segments[segments.length - 1] ?? "";
  const segmentWords = lastSegment === "" ? 0 : lastSegment.split("-").length;
  const pathValid = path !== "" && isLandingPath(path);
  const pathReserved = path !== "" && isReservedPath(path);

  add({
    id: "path-quality",
    group: "Title and Meta",
    label: "URL path",
    severity:
      !pathValid || pathReserved
        ? "error"
        : lastSegment.length > SLUG_MAX_CHARS || segmentWords > SLUG_MAX_WORDS
          ? "warning"
          : "pass",
    message: !pathValid
      ? `A path is a leading slash and up to ${MAX_PATH_SEGMENTS} lowercase hyphenated segments.`
      : pathReserved
        ? "A real route already owns this path. The page would save and then never render."
        : lastSegment.length > SLUG_MAX_CHARS || segmentWords > SLUG_MAX_WORDS
          ? `Keep the last segment under ${SLUG_MAX_CHARS} characters and ${SLUG_MAX_WORDS} words.`
          : "Clean and readable.",
    value: `${segments.length} segment${segments.length === 1 ? "" : "s"}, ${lastSegment.length} chars`,
  });

  const ogImagePath = (input.ogImagePath ?? "").trim();
  add({
    id: "og-image",
    group: "Title and Meta",
    label: "Social image",
    severity: ogImagePath === "" ? "warning" : "pass",
    message:
      ogImagePath === ""
        ? "No image set, so this page shares the site-wide /og-image.jpg with every other page."
        : "A page-specific social card is set.",
  });

  const breadcrumbs = input.breadcrumbs ?? [];
  const needsBreadcrumbs = segments.length >= BREADCRUMB_MIN_DEPTH;
  add({
    id: "breadcrumbs",
    group: "Title and Meta",
    label: "Breadcrumbs",
    severity: needsBreadcrumbs && breadcrumbs.length === 0 ? "warning" : "pass",
    message:
      needsBreadcrumbs && breadcrumbs.length === 0
        ? "A nested page with no trail emits no BreadcrumbList and gives the visitor no way up."
        : breadcrumbs.length > 0
          ? "A trail is set, so BreadcrumbList structured data is emitted."
          : "A top-level page needs no trail.",
    value: breadcrumbs.length,
  });

  add({
    id: "keyword-in-title",
    group: "Title and Meta",
    label: "Keyword in title",
    severity:
      keyword === ""
        ? "skipped"
        : countOccurrences(effectiveTitle, keyword) > 0
          ? "pass"
          : "warning",
    message:
      keyword === ""
        ? "No focus keyword set."
        : countOccurrences(effectiveTitle, keyword) > 0
          ? "The focus keyword appears in the title tag."
          : "The focus keyword does not appear in the title tag.",
  });

  const keywordPath = keyword.toLowerCase().replace(/\s+/g, "-");
  add({
    id: "keyword-in-path",
    group: "Title and Meta",
    label: "Keyword in path",
    severity:
      keyword === ""
        ? "skipped"
        : path.toLowerCase().includes(keywordPath)
          ? "pass"
          : "warning",
    message:
      keyword === ""
        ? "No focus keyword set."
        : path.toLowerCase().includes(keywordPath)
          ? "The focus keyword appears in the URL."
          : `The URL does not contain "${keywordPath}".`,
  });

  const metaCollision = cross
    ? (cross.titleCollision ?? cross.descriptionCollision)
    : null;
  add({
    id: "duplicate-meta",
    group: "Title and Meta",
    label: "Duplicate title or description",
    severity: !cross ? "skipped" : metaCollision ? "warning" : "pass",
    message: !cross
      ? 'Not checked yet — use "Check against other pages".'
      : cross.titleCollision && cross.descriptionCollision
        ? `Both the title tag and the meta description are already used by ${cross.titleCollision}.`
        : cross.titleCollision
          ? `${cross.titleCollision} already uses this title tag, so the two pages compete for the same result.`
          : cross.descriptionCollision
            ? `${cross.descriptionCollision} already uses this meta description.`
            : "The title tag and meta description are unique across landing pages.",
  });

  /* ------------------------- Content and Structure ------------------------ */

  const keywordHits = keyword === "" ? 0 : countOccurrences(plain, keyword);
  const density = wordCount === 0 ? 0 : (keywordHits / wordCount) * 100;
  add({
    id: "keyword-density",
    group: "Content and Structure",
    label: "Keyword density",
    severity:
      keyword === ""
        ? "skipped"
        : wordCount === 0
          ? "error"
          : density < DENSITY_MIN || density > DENSITY_MAX
            ? "warning"
            : "pass",
    message:
      keyword === ""
        ? "No focus keyword set."
        : wordCount === 0
          ? "There is no body text to measure against."
          : density > DENSITY_MAX
            ? `Above ${DENSITY_MAX}% reads as stuffing.`
            : density < DENSITY_MIN
              ? `Below ${DENSITY_MIN}% the page may not read as being about the keyword.`
              : `Within the ${DENSITY_MIN}–${DENSITY_MAX}% range.`,
    value: keyword === "" ? undefined : `${density.toFixed(2)}%`,
  });

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
        ? `Under ${CONTENT_MIN_WORDS} words rarely ranks. Pricing cards and nearby areas store no text, so they do not count here.`
        : wordCount < CONTENT_GOOD_WORDS
          ? `Aim for ${CONTENT_GOOD_WORDS}+ words on a page meant to rank.`
          : "A substantial page.",
    value: `${wordCount} words`,
  });

  const headings = extractHeadings(html);
  const richTextH1 = sections.some(
    (section) =>
      isKind(section, "richText") && /<\s*h1\b/i.test(section.html ?? ""),
  );
  // The synthetic H1 the hero contributes is not a fault; a second one is.
  const skipsLevel = headings.some(
    (level, index) => index > 0 && level - headings[index - 1] > 1,
  );
  const hasH2 = headings.includes(2);

  add({
    id: "heading-structure",
    group: "Content and Structure",
    label: "Heading structure",
    severity:
      heroes.length > 1 || richTextH1
        ? "error"
        : heroes.length === 0 || skipsLevel || !hasH2
          ? "warning"
          : "pass",
    message:
      heroes.length > 1
        ? "More than one hero section, so the page renders more than one H1."
        : richTextH1
          ? "A rich text section contains an <h1>. The hero heading is already the page's H1."
          : heroes.length === 0
            ? "No hero section, so the page has no H1."
            : skipsLevel
              ? "A heading level is skipped, which breaks the outline."
              : !hasH2
                ? "No H2 anywhere. Sub-headings are how a long page gets scanned."
                : "One H1 and a sensible outline beneath it.",
    value: headings.length,
  });

  const sentences = splitSentences(plain);
  const paragraphs = extractParagraphs(html);
  const averageSentence =
    sentences.length === 0 ? 0 : wordCount / sentences.length;
  const longSentences = sentences.filter(
    (sentence) => countWords(sentence) > LONG_SENTENCE_WORDS,
  ).length;
  const longShare =
    sentences.length === 0 ? 0 : (longSentences / sentences.length) * 100;
  const averageParagraph =
    paragraphs.length === 0
      ? 0
      : paragraphs.reduce((total, block) => total + countWords(block), 0) /
        paragraphs.length;
  const hardToRead =
    averageSentence > SENTENCE_MAX_WORDS ||
    longShare > LONG_SENTENCE_SHARE_MAX ||
    averageParagraph > PARAGRAPH_MAX_WORDS;

  add({
    id: "readability",
    group: "Content and Structure",
    label: "Readability",
    severity: wordCount === 0 ? "skipped" : hardToRead ? "warning" : "pass",
    message:
      wordCount === 0
        ? "There is no body text to measure."
        : hardToRead
          ? `Long sentences or paragraphs. Aim under ${SENTENCE_MAX_WORDS} words a sentence and ${PARAGRAPH_MAX_WORDS} a paragraph. These are structural proxies, not a Flesch grade.`
          : "Sentence and paragraph lengths are comfortable.",
    value: `${averageSentence.toFixed(1)} words/sentence`,
  });

  const hasCta =
    sections.some((section) => isKind(section, "cta")) ||
    heroes.some(
      (hero) => hero.primaryCta || hero.secondaryCta || hero.phoneCta,
    );
  add({
    id: "cta-present",
    group: "Content and Structure",
    label: "Call to action",
    severity: hasCta ? "pass" : "warning",
    message: hasCta
      ? "The page asks the visitor to do something."
      : "No booking CTA section and no hero call to action, so the page ranks and then converts nobody.",
  });

  const duplicate = cross?.duplicate ?? null;
  add({
    id: "duplicate-content",
    group: "Content and Structure",
    label: "Duplicate content",
    severity: !cross
      ? "skipped"
      : duplicate && duplicate.similarity > DUPLICATE_SIMILARITY_MAX
        ? "warning"
        : "pass",
    message: !cross
      ? 'Not checked yet — use "Check against other pages".'
      : !duplicate
        ? "There is no other landing page to compare against."
        : duplicate.similarity > DUPLICATE_SIMILARITY_MAX
          ? `Substantially overlaps ${duplicate.path}. Near-identical pages compete with each other.`
          : "Distinct from every other landing page.",
    value: duplicate ? `${Math.round(duplicate.similarity * 100)}%` : undefined,
  });

  /* ---------------------------- Links and Media --------------------------- */

  const links = extractLinks(html);
  const internal = links.filter((link) => link.href.startsWith("/"));
  add({
    id: "internal-links",
    group: "Links and Media",
    label: "Internal links",
    severity: internal.length === 0 ? "warning" : "pass",
    message:
      internal.length === 0
        ? "No internal links. A page with no outbound links inside the site is a dead end for crawlers."
        : "The page links onward into the site.",
    value: internal.length,
  });

  const broken = cross
    ? internal
        .filter((link) => !isResolvableTarget(link.href, cross.publishedPaths))
        .map((link) => linkPath(link.href))
    : [];
  const distinctBroken = Array.from(new Set(broken));
  add({
    id: "link-targets",
    group: "Links and Media",
    label: "Link targets",
    severity: !cross
      ? "skipped"
      : distinctBroken.length > 0
        ? "warning"
        : "pass",
    message: !cross
      ? 'Not checked yet — use "Check against other pages".'
      : distinctBroken.length > 0
        ? `Points at ${distinctBroken.slice(0, 3).join(", ")}${distinctBroken.length > 3 ? ", and others" : ""} — neither a real route nor a published landing page, so those are 404s.`
        : "Every internal link resolves to a real route or a published page.",
    value: distinctBroken.length > 0 ? distinctBroken.length : undefined,
  });

  const images = extractImages(html);
  const missingAlt = images.filter(
    (image) => image.alt === undefined || image.alt.trim() === "",
  ).length;
  add({
    id: "image-alt-text",
    group: "Links and Media",
    label: "Image alt text",
    severity: missingAlt > 0 ? "error" : "pass",
    message:
      missingAlt > 0
        ? `${missingAlt} image${missingAlt === 1 ? "" : "s"} in rich text with no alt text.`
        : images.length === 0
          ? "No images in the page's rich text."
          : "Every image has alt text.",
    value: images.length,
  });

  const external = links.filter((link) => /^https?:\/\//i.test(link.href));
  const externalWithoutRel = external.filter(
    (link) => !/\brel\s*=/i.test(link.tag),
  ).length;
  add({
    id: "external-links",
    group: "Links and Media",
    label: "External links",
    severity: externalWithoutRel > 0 ? "warning" : "pass",
    message:
      externalWithoutRel > 0
        ? `${externalWithoutRel} external link${externalWithoutRel === 1 ? "" : "s"} with no rel attribute.`
        : "No external links, or all of them carry a rel attribute.",
    value: external.length,
  });

  /* -------------------------------- Technical ----------------------------- */

  const configProblems: string[] = [];
  for (const section of sections) {
    if (isKind(section, "blockRef") && !(section.blockSlug ?? "").trim()) {
      configProblems.push("a shared block with no block chosen");
    }
    if (isKind(section, "nearbyAreas")) {
      const slug = (section.forSlug ?? "").trim();
      if (!slug || !getServiceArea(slug)) {
        configProblems.push(
          `nearby areas pointing at "${slug}", which is not a service area`,
        );
      }
    }
  }
  const distinctProblems = Array.from(new Set(configProblems));
  add({
    id: "section-config",
    group: "Technical",
    label: "Section configuration",
    severity: distinctProblems.length > 0 ? "error" : "pass",
    message:
      distinctProblems.length > 0
        ? `${distinctProblems.join("; ")}. A section like this renders as nothing, with no error anywhere.`
        : "Every section is fully configured.",
  });

  const refSlugs = sections
    .filter((section) => isKind(section, "blockRef"))
    .map((section) => (section.blockSlug ?? "").trim())
    .filter(Boolean);
  const unresolved = cross
    ? Array.from(
        new Set(
          refSlugs.filter((slug) => !cross.publishedBlockSlugs.includes(slug)),
        ),
      )
    : [];
  add({
    id: "block-refs",
    group: "Technical",
    label: "Shared blocks",
    severity: !cross ? "skipped" : unresolved.length > 0 ? "error" : "pass",
    message: !cross
      ? 'Not checked yet — use "Check against other pages".'
      : unresolved.length > 0
        ? `${unresolved.join(", ")} is missing or still a draft. A blockRef that does not resolve renders nothing at all.`
        : refSlugs.length === 0
          ? "The page uses no shared blocks."
          : "Every shared block on this page is published.",
  });

  const schemaType = input.schemaType ?? "WebPage";
  const schemaGaps: string[] = [];
  if (schemaType === "Service") {
    if (!(input.serviceAreaName ?? "").trim()) {
      schemaGaps.push("no area served, so the Service node omits areaServed");
    }
    if (!hasPricingCards) {
      schemaGaps.push(
        "no pricing cards section, so the Service node omits offers",
      );
    }
  }
  const faqPageWithoutFaq = schemaType === "FAQPage" && faqItems.length === 0;
  const faqWasted = schemaType === "none" && faqItems.length > 0;
  add({
    id: "structured-data",
    group: "Technical",
    label: "Structured data",
    severity: faqPageWithoutFaq
      ? "error"
      : schemaGaps.length > 0 || faqWasted
        ? "warning"
        : "pass",
    message: faqPageWithoutFaq
      ? "FAQPage with no FAQ section emits no structured data at all — not an FAQ node, and not a WebPage node either."
      : schemaGaps.length > 0
        ? `The Service node is emitted but incomplete: ${schemaGaps.join("; ")}.`
        : faqWasted
          ? "The page has FAQ content but the structured data type is none, so the FAQ rich result is forfeited."
          : "The structured data for this page is complete.",
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

  return summariseChecks(checks);
}
