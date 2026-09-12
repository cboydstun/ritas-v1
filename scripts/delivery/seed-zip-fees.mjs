/**
 * Apply `src/lib/delivery/zone-snapshot.json` to the settings document.
 *
 * The snapshot is a point-in-time copy of bounce-v3's production delivery
 * pricing — 94 ZIPs, each with its own fee. This script is how it reaches the
 * database; the admin map is how it is edited afterwards.
 *
 *   node scripts/delivery/seed-zip-fees.mjs --dry-run
 *   node scripts/delivery/seed-zip-fees.mjs --dry-run --force --prune-unlisted
 *   node scripts/delivery/seed-zip-fees.mjs --force
 *
 * Uses the raw driver rather than Mongoose on purpose. Schema defaults are
 * applied on *hydration*, so a document holding no `deliveryZones` reads back
 * through the model as a complete one: every predicate that asks the hydrated
 * document answers "already there" while the stored document has nothing.
 * bounce-v3 shipped a self-migration built on that assumption, it did nothing,
 * and production ran with an empty field while the API served defaults.
 *
 * Flags:
 *   --force           Overwrite a ZIP whose stored fee differs from the
 *                     snapshot. Without it the script is insert-only, which for
 *                     this rollout writes nothing: an earlier seed already
 *                     priced every ZIP at a flat $20, so the real fees only land
 *                     with --force. Insert-only stays the default so a routine
 *                     re-run can never flatten a price retuned in the admin.
 *   --prune-unlisted  $unset the fees of ZIPs the snapshot does not carry.
 *                     Priced means serviced regardless of the lists, so without
 *                     this the ZIPs dropped from the old generated list linger
 *                     as bookable. Off by default: it is the only destructive
 *                     thing here.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const PRUNE = process.argv.includes("--prune-unlisted");

/**
 * Read as JSON rather than duplicated as constants. A `.mjs` script cannot
 * import the TypeScript module, but it can read the same file the module reads,
 * so the script and `src/lib/delivery/defaultZones.ts` cannot drift.
 */
const snapshot = JSON.parse(
  readFileSync(
    new URL("../../src/lib/delivery/zone-snapshot.json", import.meta.url),
    "utf8",
  ),
);

const {
  customFees: FEES,
  insideZips: INSIDE_ZIPS,
  outsideZips: OUTSIDE_ZIPS,
} = snapshot;

/** All zeros: no floor until somebody measures one. */
const TIER_MINIMUMS = { free: 0, low: 0, standard: 0, high: 0, premium: 0 };

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
    // no .env.local — fall through to the error below
  }

  throw new Error("MONGODB_URI is not set and .env.local does not carry it");
}

function sameList(stored, wanted) {
  return (
    Array.isArray(stored) &&
    stored.length === wanted.length &&
    stored.every((zip, i) => zip === wanted[i])
  );
}

async function main() {
  const uri = mongoUri();
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(process.env.MONGODB_DB || undefined);
  const settings = db.collection("settings");
  const doc = await settings.findOne({ key: "global" });

  if (!doc) {
    throw new Error(
      'No { key: "global" } settings document. Save the admin settings page once first.',
    );
  }

  const stored = doc.deliveryZones ?? {};
  const storedFees = stored.customFees ?? {};

  const $set = {};
  const $unset = {};
  const inserts = [];
  const overwrites = [];
  const kept = [];

  for (const [zip, fee] of Object.entries(FEES)) {
    const existing = storedFees[zip];

    // Dotted paths, one per ZIP. A whole-map `$set` would revert any fee an
    // admin has retuned since — the exact clobber the narrow PATCH verbs exist
    // to prevent, and a script is not exempt from it.
    if (typeof existing !== "number") {
      $set[`deliveryZones.customFees.${zip}`] = fee;
      inserts.push(`  ${zip}  (none) -> $${fee}`);
    } else if (existing === fee) {
      kept.push(zip);
    } else if (FORCE) {
      $set[`deliveryZones.customFees.${zip}`] = fee;
      overwrites.push(`  ${zip}  $${existing} -> $${fee}`);
    } else {
      overwrites.push(
        `  ${zip}  $${existing} -> $${fee}   (skipped, needs --force)`,
      );
    }
  }

  const unlisted = Object.keys(storedFees)
    .filter((zip) => typeof FEES[zip] !== "number")
    .sort();

  if (PRUNE) {
    for (const zip of unlisted) $unset[`deliveryZones.customFees.${zip}`] = "";
  }

  if (!sameList(stored.insideZips, INSIDE_ZIPS)) {
    $set["deliveryZones.insideZips"] = INSIDE_ZIPS;
  }
  if (!sameList(stored.outsideZips, OUTSIDE_ZIPS)) {
    $set["deliveryZones.outsideZips"] = OUTSIDE_ZIPS;
  }
  if (!stored.tierMinimums) {
    $set["deliveryZones.tierMinimums"] = TIER_MINIMUMS;
  }
  if (typeof doc.fees?.minOrderAmount !== "number") {
    $set["fees.minOrderAmount"] = 0;
  }

  const isLocal = /(localhost|127\.0\.0\.1)/.test(uri);
  console.log(
    `Target             : ${isLocal ? "LOCAL" : "REMOTE"} (${uri.replace(/\/\/[^@]*@/, "//<credentials>@")})`,
  );
  console.log(`Settings document  : ${doc._id}`);
  console.log(`Snapshot           : ${snapshot.source}`);
  console.log(
    `Snapshot ZIPs      : ${Object.keys(FEES).length} priced, ${INSIDE_ZIPS.length} inside + ${OUTSIDE_ZIPS.length} outside`,
  );
  console.log(`Stored priced ZIPs : ${Object.keys(storedFees).length}`);
  console.log(
    `Unchanged          : ${kept.length}\n` +
      `Inserts            : ${inserts.length}\n` +
      `Fee changes        : ${overwrites.length}${FORCE ? "" : " (none applied without --force)"}`,
  );

  if (inserts.length) console.log(`\nnew fees:\n${inserts.join("\n")}`);
  if (overwrites.length)
    console.log(`\nchanged fees:\n${overwrites.join("\n")}`);

  if (unlisted.length) {
    console.log(
      `\npriced but not in the snapshot (${unlisted.length})${PRUNE ? ", REMOVING" : ", left in place — pass --prune-unlisted to remove"}:`,
    );
    console.log(
      unlisted.map((zip) => `  ${zip}  $${storedFees[zip]}`).join("\n"),
    );
  }

  const listFields = Object.keys($set).filter(
    (k) => !k.startsWith("deliveryZones.customFees."),
  );
  console.log(`\nOther fields       : ${listFields.join(", ") || "none"}`);

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;

  if (!Object.keys(update).length) {
    console.log("\nNothing to do.");
  } else if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
  } else {
    const result = await settings.updateOne({ _id: doc._id }, update);
    console.log(`\nModified ${result.modifiedCount} document(s).`);

    const after = await settings.findOne({ _id: doc._id });
    const afterFees = after.deliveryZones?.customFees ?? {};
    console.log(`Priced ZIPs now    : ${Object.keys(afterFees).length}`);
    console.log(
      `Listed ZIPs now    : ${(after.deliveryZones?.insideZips ?? []).length} inside + ${(after.deliveryZones?.outsideZips ?? []).length} outside`,
    );
  }

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
