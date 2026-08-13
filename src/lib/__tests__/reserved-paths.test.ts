/**
 * @jest-environment node
 *
 * Walks `src/app/` and fails if a real route exists that `isReservedPath`
 * does not cover.
 *
 * This is the mechanism that keeps `RESERVED_EXACT` / `RESERVED_PREFIXES`
 * honest. Next always prefers a static or `[param]` route over the root
 * catch-all, so a landing page created at a path a real route owns saves
 * happily and then never renders — an admin-confusion bug with no error
 * anywhere. The reserved check turns that into a 400 at write time, and this
 * test is what stops the list going stale the next time someone adds a route.
 *
 * It is a coverage question, not an equality one: the list may legitimately
 * reserve paths that are not routes (`_next`, `favicon`).
 */

import fs from "node:fs";
import path from "node:path";
import { isReservedPath } from "@/lib/landing";

const APP_DIR = path.join(process.cwd(), "src", "app");
const ROUTE_FILES = new Set(["page.tsx", "page.ts", "route.tsx", "route.ts"]);

/** Every first path segment under `src/app` that has a route file beneath it. */
function routeSegments(): string[] {
  const segments = new Set<string>();

  const walk = (dir: string, firstSegment: string | null) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Route groups are not URL segments, and a dynamic segment cannot be
        // written down as a reserved literal.
        const isDynamic =
          entry.name.startsWith("[") || entry.name.startsWith("(");
        walk(
          path.join(dir, entry.name),
          firstSegment ?? (isDynamic ? null : entry.name),
        );
        continue;
      }
      if (!ROUTE_FILES.has(entry.name)) continue;
      // A route file at the top of src/app is the home page, "/".
      segments.add(firstSegment ?? "/");
    }
  };

  walk(APP_DIR, null);
  return [...segments].sort();
}

describe("reserved paths cover every real route", () => {
  const segments = routeSegments();

  it("finds the routes it is meant to be checking", () => {
    // A silent zero here would make every assertion below vacuously pass.
    expect(segments.length).toBeGreaterThan(5);
    expect(segments).toContain("order");
  });

  it.each(routeSegments())("reserves /%s, which is a real route", (segment) => {
    const routePath = segment === "/" ? "/" : `/${segment}`;
    expect(isReservedPath(routePath)).toBe(true);
  });

  it("still allows the paths the seeded city pages need", () => {
    expect(isReservedPath("/service-area/olmos-park")).toBe(false);
  });
});
