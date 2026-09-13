/**
 * Rewrite the delivery claims already stored in Mongo.
 *
 * The 16 `/service-area/*` landing pages and one seeded blog post were written
 * with `$setOnInsert` upserts, so **re-seeding will not touch them** — the
 * seeder only creates rows it does not already own. That is the right
 * behaviour (an admin's later edit survives a re-run) and it means a copy
 * change in git does not reach production on its own.
 *
 * Two generations of claim have had to be rewritten this way, so the sentences
 * are a **chain** rather than a pair. Generation 1: the rows promised "a flat
 * fee, no per-mile charge" and "a flat fee inside Bexar County" after delivery
 * became per-ZIP. Generation 2: they said the distance surcharge was the only
 * delivery charge, after `deliveryZones.baseFee` made every order pay a
 * delivery and setup fee on top of it.
 *
 * A chain rather than a pair because a row that was never migrated is still on
 * generation 1, and a row this script already touched is on generation 2. The
 * rewrites are applied in order, so both land on the current copy in one run.
 *
 *   node scripts/delivery/fix-delivery-copy.mjs --dry-run
 *   node scripts/delivery/fix-delivery-copy.mjs
 *
 * Idempotent: each rewrite matches its own old sentence and does nothing once
 * it is gone. A second run must report zero writes.
 *
 * No redeploy needed afterwards: `src/app/[...slug]/page.tsx` and
 * `src/app/blog/[slug]/page.tsx` both export `revalidate = 60`, so the pages
 * pick this up within a minute. (bounce-v3's equivalent seeder carries a
 * "re-deploy to bust ISR" warning because its landing pages sit on a one-hour
 * window; ours do not.)
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Oldest first. The last `to` must stay byte-identical to `DELIVERY_INCLUDES`
 * in src/lib/service-area-page.ts, or a freshly seeded row and a migrated one
 * carry different copy.
 */
const BULLET_REWRITES = [
  {
    from: "Delivery and pickup — a flat fee, no per-mile charge.",
    to: "Delivery, setup and pickup — the distance surcharge is set by your ZIP code and quoted before you book.",
  },
  {
    from: "Delivery, setup and pickup — the distance surcharge is set by your ZIP code and quoted before you book.",
    to: "Delivery, setup and pickup — a delivery and setup fee every order pays, plus a distance surcharge set by your ZIP code, both quoted before you book.",
  },
];

/** Same chain, for the seeded blog post's body. */
const BLOG_REWRITES = [
  {
    from: '<p>Delivery is a flat fee inside Bexar County. If you sit outside the county line, check the <a href="/service-area">service area pages</a> first. A margarita machine rental to a surrounding town may need a different delivery window.</p>',
    to: '<p>Setup and pickup are included everywhere we go. What varies is how far the truck drives, so each ZIP code carries its own distance surcharge — enter yours at checkout and you will see it before you book. Check the <a href="/service-area">service area pages</a> for local notes; a margarita machine rental to a surrounding town may need a different delivery window.</p>',
  },
  {
    from: "<p>Setup and pickup are included everywhere we go. What varies is how far the truck drives, so each ZIP code carries its own distance surcharge — enter yours at checkout and you will see it before you book.",
    to: "<p>Delivery is two charges. A delivery and setup fee that every order pays, and a distance surcharge for how far the truck drives, so each ZIP code carries its own — enter yours at checkout and you will see both before you book.",
  },
];

/** Applies the chain in order, reporting whether anything moved. */
function applyChain(text, rewrites) {
  let out = text;
  for (const { from, to } of rewrites) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

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
        if (typeof item?.body !== "string") return item;
        const body = applyChain(item.body, BULLET_REWRITES);
        if (body === item.body) return item;
        touched = true;
        return { ...item, body };
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

  // Scanned rather than filtered by regex: the chain has two generations now,
  // so "which rows need work" is whatever the chain actually changes.
  const allPosts = await db
    .collection("blogposts")
    .find({ body: { $type: "string" } })
    .toArray();

  const posts = [];
  for (const post of allPosts) {
    const body = applyChain(post.body, BLOG_REWRITES);
    if (body === post.body) continue;
    posts.push(post);
    console.log(`  blog: ${post.slug}`);
    if (!DRY_RUN) {
      await db
        .collection("blogposts")
        .updateOne({ _id: post._id }, { $set: { body } });
    }
  }

  console.log(
    `\nLanding pages to fix: ${pagesChanged} of ${pages.length} scanned`,
  );
  console.log(`Blog posts to fix   : ${posts.length}`);
  if (DRY_RUN) console.log("\n--dry-run: nothing written.");
  else if (pagesChanged + posts.length === 0) console.log("\nNothing to do.");
  else console.log("\nDone. Live within ~60s (revalidate = 60).");

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
