/**
 * @jest-environment node
 *
 * Walks `src/` and fails if a real phone number is written anywhere except
 * `src/lib/site.ts`.
 *
 * The business number changed on 2026-09-16, from the owner's cell
 * (512) 210-0194 to the Twilio line (210) 293-6120. The old number was
 * hard-coded in four JSON-LD blocks, two pages and the global error boundary,
 * so moving it meant hunting for copies. Every surface now reads the
 * `BUSINESS_PHONE_*` constants, and this test is what keeps the next change a
 * one-line edit.
 *
 * Fictional numbers are allowed: the 555 exchange and the `123-456-7890`
 * placeholder shape. Tests are skipped — they may legitimately click a
 * literal `tel:` link.
 */

import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.join(process.cwd(), "src");
const SOURCE_OF_TRUTH = path.join(SRC_DIR, "lib", "site.ts");

const PHONE_SHAPES = [
  /tel:\+?\d/g,
  /\+1\d{10}\b/g,
  /\(?\b\d{3}\)?[ .-]\d{3}-\d{4}\b/g,
];

const isFictional = (match: string) => {
  const digits = match.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.slice(3, 6) === "555" || digits === "1234567890";
};

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") files.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|json|css|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("phone number literals", () => {
  it("live only in src/lib/site.ts", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC_DIR)) {
      if (file === SOURCE_OF_TRUTH) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const shape of PHONE_SHAPES) {
        for (const [match] of text.matchAll(shape)) {
          if (shape.source.startsWith("tel") || !isFictional(match)) {
            offenders.push(`${path.relative(SRC_DIR, file)}: ${match}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("would catch the retired number", () => {
    const hits = PHONE_SHAPES.flatMap((shape) => [
      ...'href="tel:+15122100194">(512) 210-0194'.matchAll(shape),
    ]).map(([m]) => m);

    expect(hits.filter((m) => !isFictional(m)).length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
