/**
 * @jest-environment node
 *
 * Delivery costs what the ZIP costs. This scans the public copy for claims
 * that say otherwise.
 *
 * The site advertised "a flat fee, no per-mile charge" on all 16 service-area
 * pages, "$20.00 flat fee" hardcoded on /pricing, and three mutually
 * inconsistent service areas — "Bexar County", "the San Antonio metropolitan
 * area", "within 30 miles of downtown" — while the checkout charged per ZIP
 * and refused anything unpriced. Copy drifts back; a test does not.
 *
 * Deliberately **not** scanned: components that render an already-resolved fee
 * (they quote a real number for a real ZIP), notification email, and the whole
 * admin tree, which is allowed to say "delivery fee" because that is the field
 * name on the wire.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..", "..", "..");

/**
 * Every file holding a delivery claim a customer can read.
 *
 * The count is pinned below so a new public page cannot quietly escape the
 * scan by not being added here.
 */
const PUBLIC_COPY = [
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/order/page.tsx",
  "src/app/faq/page.tsx",
  "src/app/about/page.tsx",
  "src/app/contact/page.tsx",
  "src/app/service-area/page.tsx",
  "src/app/long-term-lease/page.tsx",
  "src/components/home/MapSection.tsx",
  "src/components/BookingCTA.tsx",
  "src/components/Footer.tsx",
  "src/components/order/steps/DateSelectionStep.tsx",
  "src/components/order/steps/DetailsStep.tsx",
  "src/components/order/steps/ExtrasStep.tsx",
  "src/components/order/steps/ReviewStep.tsx",
  "src/components/order/OrderForm.tsx",
  // Seeds. These are written into Mongo, so a stale claim here outlives the
  // deploy that introduced it.
  "src/lib/service-area-page.ts",
  "src/lib/blog-seed.ts",
];

interface Ban {
  label: string;
  pattern: RegExp;
}

/**
 * Proximity patterns, not bare words.
 *
 * "one-time flat fee" is *true* of a mixer and false of delivery, so a bare
 * `/flat fee/` ban would have to be suppressed in `ExtrasStep`, and a
 * suppression is how a lint stops being read.
 */
const BANS: Ban[] = [
  {
    label: 'a flat delivery charge ("flat fee", "flat-rate delivery")',
    pattern: /\bflat\b[^.!?]{0,60}\b(deliver\w*|surcharge)\b/i,
  },
  {
    label: "delivery described as flat",
    pattern: /\b(deliver\w*|surcharge)\b[^.!?]{0,60}\bflat\b/i,
  },
  { label: "a no-per-mile promise", pattern: /no per[- ]mile/i },
  { label: "free delivery", pattern: /\bfree\b[^.!?]{0,30}\bdeliver/i },
  {
    label: "delivery described as free",
    pattern: /\bdeliver\w*[^.!?]{0,30}\b(is|are) free\b/i,
  },
  {
    label: "a county-shaped service area",
    pattern:
      /\bdeliver\w*[^.!?]{0,60}\b(within|inside|throughout)\b[^.!?]{0,30}\bBexar\b/i,
  },
  {
    label: "a mileage-shaped service area",
    pattern: /within \d+ miles/i,
  },
  // Added when `deliveryZones.baseFee` shipped. Delivery used to be the ZIP's
  // surcharge alone, so "delivery included" was merely generous-sounding on a
  // $0 ZIP; now every order pays a delivery and setup fee and the sentence is
  // simply false. Seven surfaces said it, including the review step directly
  // above the itemised Delivery Fee.
  {
    label: "delivery described as included",
    pattern: /\bdeliver\w*\b[^.!?]{0,60}\bincluded\b/i,
  },
  {
    label: "setup or pickup described as included",
    pattern: /\b(set[- ]?up|pick[- ]?up)\b[^.!?]{0,60}\bincluded\b/i,
  },
];

/**
 * The customer-visible text of a file: comments stripped, JSX string joins and
 * entities collapsed, whitespace normalised so a claim split across lines still
 * matches.
 *
 * Comments are stripped on purpose. A comment recording *why* a flat-fee claim
 * was removed is the most useful line in the file, and a lint that forbids
 * naming the thing it forbids is a lint people route around.
 */
function readCopy(file: string): string {
  return fs
    .readFileSync(path.join(ROOT, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{"\s+"\}/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/\s+/g, " ");
}

describe("public delivery copy", () => {
  it("scans every file it is supposed to", () => {
    // Pinned so a new public page has to be added here deliberately.
    expect(PUBLIC_COPY).toHaveLength(18);
    for (const file of PUBLIC_COPY) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
  });

  describe.each(PUBLIC_COPY)("%s", (file) => {
    const copy = readCopy(file);

    it.each(BANS.map((b) => [b.label, b.pattern] as const))(
      "does not claim %s",
      (_label, pattern) => {
        expect(copy.match(pattern)?.[0] ?? null).toBeNull();
      },
    );
  });
});

describe("the detector itself", () => {
  // Guards the patterns: if these ever stop matching, every assertion above is
  // passing for the wrong reason.
  const flags = (text: string) => BANS.filter((b) => b.pattern.test(text));

  it.each([
    "Delivery and pickup — a flat fee, no per-mile charge.",
    "Flat-rate delivery & setup throughout Bexar County",
    "The delivery fee is a flat one-time charge.",
    "Delivery is a flat fee inside Bexar County.",
    "We serve additional areas within 30 miles of downtown San Antonio.",
    "Free delivery for your area!",
    "We only deliver within Bexar County, TX.",
    "Professional delivery, setup, and pickup included.",
    "Delivery & Setup: Included — distance surcharge by ZIP",
    "Delivery, setup and pickup included — surcharge quoted by ZIP",
    "Setup and pickup are included everywhere we go.",
    "All-inclusive pricing with delivery, setup, and pickup included",
  ])("flags %s", (claim) => {
    expect(flags(claim).length).toBeGreaterThan(0);
  });

  it.each([
    "Party extras are charged per day; mixers are a one-time flat fee.",
    "The distance surcharge is set by your ZIP code and quoted before you book.",
    "Delivery, setup and pickup — the surcharge is set by your ZIP code.",
    "No distance surcharge for 78205",
    // The replacement wording. It has to survive both new detectors, or the
    // ban is unsatisfiable and the next person suppresses it.
    "Delivery is a delivery and setup fee every order pays, plus a distance surcharge set by your ZIP code.",
    "$20 delivery and setup, plus a $50 distance surcharge for your ZIP.",
    "We handle delivery, setup & cleanup",
    // A rental period, a mixer and a table really are included. The ban is
    // about the three things the truck does, not the word.
    "Each rental includes free overnight use by default.",
    "24-hour rental period included",
    "Alcohol not included — Texas TABC prohibits us from providing it.",
  ])("leaves %s alone", (claim) => {
    expect(flags(claim)).toEqual([]);
  });
});
