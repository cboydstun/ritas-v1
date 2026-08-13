/**
 * @jest-environment node
 *
 * Pins the one line that keeps the sitemap honest.
 *
 * `src/app/sitemap.ts` reads blog slugs and landing paths from the database.
 * Without a `revalidate` (or `dynamic`) export Next prerenders it once at build
 * and freezes that list, so anything published afterwards returns 200 while
 * never appearing in the sitemap — a silent failure with no error anywhere.
 * That happened: three published posts sat unlisted until this was added.
 *
 * Asserted against the file text rather than by importing the module, because
 * importing it pulls in `src/lib/mongodb.ts`, which throws at import time
 * without a connection string.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

/**
 * Routes that read the database at render time.
 *
 * `src/app/page.tsx` is deliberately absent: it reads only `getReviewSummary`,
 * whose `fetch` carries its own `next: { revalidate: 3600 }`.
 */
const DB_BACKED_ROUTES = [
  "src/app/sitemap.ts",
  "src/app/pricing/page.tsx",
  "src/app/order/page.tsx",
  "src/app/long-term-lease/page.tsx",
  "src/app/blog/page.tsx",
  "src/app/blog/[slug]/page.tsx",
  "src/app/[...slug]/page.tsx",
];

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("sitemap freshness", () => {
  it("declares a positive revalidate window", () => {
    const match = /export const revalidate = (\d+)/.exec(
      read("src/app/sitemap.ts"),
    );

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });

  it.each(DB_BACKED_ROUTES)(
    "%s opts out of build-time-only rendering",
    (file) => {
      const source = read(file);
      const declares =
        /export const revalidate\s*=/.test(source) ||
        /export const dynamic\s*=/.test(source);

      expect({ file, declares }).toEqual({ file, declares: true });
    },
  );
});
