/**
 * @jest-environment node
 *
 * Walks the public `.tsx` tree and fails when a brand colour is used as text
 * or an icon without the dark-surface counterpart beside it.
 *
 * The brand palette was chosen against white. `--color-margarita` (#4b7a0a) is
 * 5.14:1 on white and 2.46:1 on `--color-charcoal`; `--color-teal` (#026b62) is
 * 6.4:1 on white and 1.97:1 on charcoal. Both need their `*-dark` counterpart
 * (6.20:1 and 6.79:1 respectively) anywhere the surface flips. The same holds
 * for the faded tiers: `text-charcoal/50` is 2.85:1 on white and
 * `dark:text-white/50` is 4.43:1 on charcoal, so /70 and /60 are the floors.
 *
 * CI has no browser and cannot measure a rendered contrast ratio, so this is a
 * source-shape ratchet in the same spirit as `reserved-paths.test.ts`: it
 * cannot prove a page passes AA, but it does stop the 43 sites fixed here from
 * quietly coming back one component at a time.
 *
 * Admin screens are out of scope — they route colour through
 * `src/components/admin/form-styles.ts`, which is already dark-aware.
 *
 * ALLOWED below is for the cases where a brand colour sits on a fill that does
 * *not* flip. Add to it only with the reason written down.
 */

import fs from "node:fs";
import path from "node:path";

const ROOTS = [
  path.join(process.cwd(), "src", "app"),
  path.join(process.cwd(), "src", "components"),
];

/**
 * Substrings that make a line exempt, each with why it does not flip.
 *
 * The checkbox accent is the one real case: `text-margarita` there is the
 * *fill* of the checked box, not text on the page. White on #4b7a0a is 5.14:1;
 * swapping in the lighter green for dark mode would put white on #8ec63f at
 * 2.04:1 and make the tick harder to see, not easier.
 */
const ALLOWED = ["h-5 w-5 text-margarita border-gray-300"];

/** Every `.tsx` under src/app and src/components, admin excluded. */
function sourceFiles(): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "admin" || entry.name === "__tests__") continue;
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".tsx")) out.push(full);
    }
  };

  for (const root of ROOTS) walk(root);
  return out;
}

type Offence = { file: string; line: number; rule: string; text: string };

/**
 * A utility needs its counterpart on the same line.
 *
 * Line-scoped on purpose: a className is written as one string, and checking
 * the whole file would let a `dark:` variant three elements away satisfy the
 * rule for an element that has none.
 */
const PAIRS: { rule: string; used: RegExp; needs: RegExp }[] = [
  {
    rule: "text-teal needs dark:text-teal-dark",
    used: /(?<![\w:-])text-teal(?![\w-])/,
    needs: /dark:text-teal-dark(?![\w-])/,
  },
  {
    rule: "hover:text-teal needs dark:hover:text-teal-dark",
    used: /(?<![\w-])hover:text-teal(?![\w-])/,
    needs: /dark:hover:text-teal-dark(?![\w-])/,
  },
  {
    rule: "text-margarita needs dark:text-margarita-dark",
    used: /(?<![\w-:])text-margarita(?![\w-/])/,
    needs: /dark:text-margarita-dark(?![\w-])/,
  },
  {
    rule: "hover:text-margarita needs dark:hover:text-margarita-dark",
    used: /(?<![\w-])hover:text-margarita(?![\w-/])/,
    needs: /dark:hover:text-margarita-dark(?![\w-])/,
  },
];

/** Opacity tiers that miss AA at one end or the other. Measured, not guessed. */
const BANNED: { rule: string; used: RegExp }[] = [
  {
    rule: "text-charcoal/50 is 2.85:1 on white — use text-charcoal/70",
    used: /(?<![\w-])text-charcoal\/50(?![\d])/,
  },
  {
    rule: "text-charcoal/60 is 3.71:1 on white — use text-charcoal/70",
    used: /(?<![\w-])text-charcoal\/60(?![\d])/,
  },
  {
    rule: "dark:text-white/50 is 4.43:1 on charcoal — use dark:text-white/60",
    used: /dark:text-white\/50(?![\d])/,
  },
  {
    rule: "dark:text-white/40 is 3.32:1 on charcoal — use dark:text-white/60",
    used: /dark:text-white\/40(?![\d])/,
  },
];

function scan(): Offence[] {
  const offences: Offence[] = [];

  for (const file of sourceFiles()) {
    const rel = path.relative(process.cwd(), file);
    const lines = fs.readFileSync(file, "utf8").split("\n");

    lines.forEach((line, index) => {
      if (ALLOWED.some((allowed) => line.includes(allowed))) return;

      for (const { rule, used, needs } of PAIRS) {
        if (used.test(line) && !needs.test(line)) {
          offences.push({
            file: rel,
            line: index + 1,
            rule,
            text: line.trim(),
          });
        }
      }

      for (const { rule, used } of BANNED) {
        if (used.test(line)) {
          offences.push({
            file: rel,
            line: index + 1,
            rule,
            text: line.trim(),
          });
        }
      }
    });
  }

  return offences;
}

describe("brand colours carry their dark-surface counterpart", () => {
  it("finds files to check", () => {
    expect(sourceFiles().length).toBeGreaterThan(30);
  });

  it("has no unpaired brand colour and no sub-AA opacity tier", () => {
    const offences = scan();
    const report = offences
      .map(
        (o) => `${o.file}:${o.line} — ${o.rule}\n    ${o.text.slice(0, 140)}`,
      )
      .join("\n");

    expect(report).toBe("");
  });
});
