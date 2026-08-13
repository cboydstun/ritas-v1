/**
 * @jest-environment node
 *
 * The gate on `src/lib/blog-seed.ts`.
 *
 * These posts are written straight into the production `blogposts` collection
 * by a one-off script that talks to the mongodb driver, which means neither
 * `blogPostCreateSchema` nor the `BlogPost` model's validators run on the way
 * in. This suite runs both of them offline, plus the same `auditPost` the admin
 * panel renders, so the seed cannot be wrong in a way only production shows.
 *
 * The score assertion is deliberately exact. `skipped` checks are excluded from
 * the audit's denominator, so a rule that stops applying would keep the score at
 * 100 while quietly measuring less — hence the applicable-count assertion
 * alongside it.
 */
import fs from "fs";
import path from "path";

import { BLOG_SEED_POSTS } from "@/lib/blog-seed";
import {
  auditPost,
  similarity,
  DUPLICATE_SIMILARITY_MAX,
} from "@/lib/seo-audit";
import { blogPostCreateSchema } from "@/lib/validation";
import { BlogPost } from "@/models/blogPost";

/** Every check applies once the post is published with a keyword and a clean duplicate report. */
const EXPECTED_APPLICABLE_CHECKS = 16;

const PUBLISHED_AT = new Date("2026-08-12T15:00:00.000Z");

/** Readable failure output — a bare `expect(score).toBe(100)` says nothing useful. */
const describeFailures = (
  checks: {
    id: string;
    severity: string;
    message: string;
    value?: string | number;
  }[],
) =>
  checks
    .filter(
      (check) => check.severity === "error" || check.severity === "warning",
    )
    .map(
      (check) =>
        `${check.severity} ${check.id}: ${check.message} (${check.value ?? "-"})`,
    )
    .join("\n");

describe("blog seed posts", () => {
  it("ships exactly three posts with unique slugs", () => {
    expect(BLOG_SEED_POSTS).toHaveLength(3);
    expect(new Set(BLOG_SEED_POSTS.map((post) => post.slug)).size).toBe(3);
  });

  describe.each(BLOG_SEED_POSTS.map((post) => [post.slug, post] as const))(
    "%s",
    (_slug, post) => {
      it("satisfies blogPostCreateSchema", () => {
        const parsed = blogPostCreateSchema.safeParse(post);
        expect(parsed.success ? null : parsed.error.issues).toBeNull();
      });

      it("satisfies the BlogPost model validators", async () => {
        const doc = new BlogPost({
          ...post,
          status: "published",
          publishedAt: PUBLISHED_AT,
        });
        await expect(doc.validate()).resolves.toBeUndefined();
      });

      it("has a cover image that exists in public/", () => {
        const file = path.join(process.cwd(), "public", post.coverImagePath);
        expect(fs.existsSync(file)).toBe(true);
      });

      it("scores 100 with all sixteen checks applicable", () => {
        const report = auditPost({
          ...post,
          status: "published",
          publishedAt: PUBLISHED_AT,
          duplicate: null,
        });

        const applicable = report.checks.filter(
          (check) => check.severity !== "skipped",
        );

        expect(describeFailures(report.checks)).toBe("");
        expect(applicable).toHaveLength(EXPECTED_APPLICABLE_CHECKS);
        expect(report.errors).toBe(0);
        expect(report.warnings).toBe(0);
        expect(report.score).toBe(100);
      });
    },
  );

  it("keeps every pair of bodies under the duplicate threshold", () => {
    for (let i = 0; i < BLOG_SEED_POSTS.length; i += 1) {
      for (let j = i + 1; j < BLOG_SEED_POSTS.length; j += 1) {
        const score = similarity(
          BLOG_SEED_POSTS[i].body,
          BLOG_SEED_POSTS[j].body,
        );
        expect({
          pair: `${BLOG_SEED_POSTS[i].slug} vs ${BLOG_SEED_POSTS[j].slug}`,
          overThreshold: score > DUPLICATE_SIMILARITY_MAX,
        }).toEqual({
          pair: `${BLOG_SEED_POSTS[i].slug} vs ${BLOG_SEED_POSTS[j].slug}`,
          overThreshold: false,
        });
      }
    }
  });
});
