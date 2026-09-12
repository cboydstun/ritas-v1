/**
 * Rewrite the delivery claims already stored in Mongo.
 *
 * The 16 `/service-area/*` landing pages and one seeded blog post were written
 * with `$setOnInsert` upserts, so **re-seeding will not touch them** — the
 * seeder only creates rows it does not already own. That is the right
 * behaviour (an admin's later edit survives a re-run) and it means a copy
 * change in git does not reach production on its own.
 *
 * Those rows promise "a flat fee, no per-mile charge" and "a flat fee inside
 * Bexar County". Delivery is now priced per ZIP and an unpriced ZIP is refused,
 * so both sentences are false on a live site.
 *
 *   node scripts/delivery/fix-delivery-copy.mjs --dry-run
 *   node scripts/delivery/fix-delivery-copy.mjs
 *
 * Idempotent: it matches the old sentence and does nothing once it is gone. A
 * second run must report zero writes. Seeding cannot bust ISR — the deploy
 * does — so expect up to an hour of stale HTML unless one follows.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

/** Must stay byte-identical to `DELIVERY_INCLUDES` in src/lib/service-area-page.ts. */
const OLD_BULLET = "Delivery and pickup — a flat fee, no per-mile charge.";
const NEW_BULLET =
  "Delivery, setup and pickup — the distance surcharge is set by your ZIP code and quoted before you book.";

const OLD_BLOG =
  '<p>Delivery is a flat fee inside Bexar County. If you sit outside the county line, check the <a href="/service-area">service area pages</a> first. A margarita machine rental to a surrounding town may need a different delivery window.</p>';
const NEW_BLOG =
  '<p>Setup and pickup are included everywhere we go. What varies is how far the truck drives, so each ZIP code carries its own distance surcharge — enter yours at checkout and you will see it before you book. Check the <a href="/service-area">service area pages</a> for local notes; a margarita machine rental to a surrounding town may need a different delivery window.</p>';

function mongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const env = readFileSync(
      new URL("../../.env.local", import.meta.url),
      "utf8",
    );
    const line = env.split("\n").find((l) => l.startsWith("MONGODB_URI="));
    if (line)
      return line
        .slice("MONGODB_URI=".length)
        .trim()
        .replace(/^["']|["']$/g, "");
  } catch {
    // no .env.local — fall through
  }
  throw new Error("MONGODB_URI is not set and .env.local does not carry it");
}

async function main() {
  const client = new MongoClient(mongoUri());
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || undefined);

  let pagesChanged = 0;
  const pages = await db
    .collection("landingpages")
    .find({ path: { $regex: "^/service-area/" } })
    .toArray();

  for (const page of pages) {
    // The bullet lives inside a Mixed `sections` array, so this walks the
    // stored document rather than trusting an index: section order is editable
    // in the admin and a positional write would eventually hit the wrong one.
    let touched = false;
    const sections = (page.sections ?? []).map((section) => {
      if (!Array.isArray(section?.items)) return section;
      const items = section.items.map((item) => {
        if (item?.body !== OLD_BULLET) return item;
        touched = true;
        return { ...item, body: NEW_BULLET };
      });
      return touched ? { ...section, items } : section;
    });

    if (!touched) continue;
    pagesChanged += 1;
    console.log(`  ${page.path}`);
    if (!DRY_RUN) {
      await db
        .collection("landingpages")
        .updateOne({ _id: page._id }, { $set: { sections } });
    }
  }

  const posts = await db
    .collection("blogposts")
    .find({ body: { $regex: "flat fee inside Bexar County" } })
    .toArray();

  for (const post of posts) {
    console.log(`  blog: ${post.slug}`);
    if (!DRY_RUN) {
      await db
        .collection("blogposts")
        .updateOne(
          { _id: post._id },
          { $set: { body: post.body.replace(OLD_BLOG, NEW_BLOG) } },
        );
    }
  }

  console.log(
    `\nLanding pages to fix: ${pagesChanged} of ${pages.length} scanned`,
  );
  console.log(`Blog posts to fix   : ${posts.length}`);
  if (DRY_RUN) console.log("\n--dry-run: nothing written.");
  else if (pagesChanged + posts.length === 0) console.log("\nNothing to do.");
  else console.log("\nDone. Redeploy to bust ISR.");

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
