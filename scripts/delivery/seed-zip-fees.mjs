/**
 * Give every ZIP in the service area its own delivery fee.
 *
 * One-time, idempotent, additive. Run it against production once before the
 * pricing path starts reading `deliveryZones` — that is the commit that begins
 * refusing an unpriced ZIP, and an empty fee map at that moment refuses every
 * booking there is.
 *
 * Uses the raw driver rather than Mongoose on purpose. Schema defaults are
 * applied on *hydration*, so a document holding no `deliveryZones` reads back
 * through the model as a complete one: every predicate that asks the hydrated
 * document answers "already there" while the stored document has nothing.
 * bounce-v3 shipped a self-migration built on that assumption, it did nothing,
 * and production ran with an empty field while the API served defaults.
 *
 *   node scripts/delivery/seed-zip-fees.mjs --dry-run
 *   node scripts/delivery/seed-zip-fees.mjs
 *
 * A second run must report zero writes. Fees are written only where the ZIP has
 * none, so a re-run cannot flatten a retuned price back to the flat fee.
 */

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Duplicated from `src/lib/delivery/defaultZones.ts` — a .mjs script cannot
 * import the TypeScript module. `src/lib/delivery/__tests__/defaultZones.test.ts`
 * pins the same numbers on the application side.
 */
const INSIDE_ZIPS = Array.from(
  { length: 99 },
  (_, i) => `782${String(i + 1).padStart(2, "0")}`,
);

const OUTSIDE_ZIPS = [
  "78002",
  "78006",
  "78009",
  "78015",
  "78023",
  "78039",
  "78052",
  "78054",
  "78056",
  "78069",
  "78073",
  "78101",
  "78108",
  "78109",
  "78112",
  "78124",
  "78148",
  "78150",
  "78152",
  "78154",
  "78163",
];

/** The flat fee this system replaces. Day one changes nobody's price. */
const SEED_FLAT_FEE = 20;

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

async function main() {
  const client = new MongoClient(mongoUri());
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

  const zips = [...INSIDE_ZIPS, ...OUTSIDE_ZIPS];
  const $set = {};

  for (const zip of zips) {
    // Dotted paths, one per ZIP. A whole-map `$set` would revert any fee an
    // admin has retuned since — the exact clobber the narrow PATCH verbs exist
    // to prevent, and a script is not exempt from it.
    if (typeof storedFees[zip] !== "number") {
      $set[`deliveryZones.customFees.${zip}`] = SEED_FLAT_FEE;
    }
  }

  if (!Array.isArray(stored.insideZips) || stored.insideZips.length === 0) {
    $set["deliveryZones.insideZips"] = INSIDE_ZIPS;
  }
  if (!Array.isArray(stored.outsideZips) || stored.outsideZips.length === 0) {
    $set["deliveryZones.outsideZips"] = OUTSIDE_ZIPS;
  }
  if (!stored.tierMinimums) {
    $set["deliveryZones.tierMinimums"] = TIER_MINIMUMS;
  }
  if (typeof doc.fees?.minOrderAmount !== "number") {
    $set["fees.minOrderAmount"] = 0;
  }

  const feeWrites = Object.keys($set).filter((k) =>
    k.startsWith("deliveryZones.customFees."),
  ).length;

  console.log(`Settings document : ${doc._id}`);
  console.log(`ZIPs already priced: ${Object.keys(storedFees).length}`);
  console.log(`ZIPs to price      : ${feeWrites} at $${SEED_FLAT_FEE}`);
  console.log(
    `Other fields       : ${
      Object.keys($set)
        .filter((k) => !k.startsWith("deliveryZones.customFees."))
        .join(", ") || "none"
    }`,
  );

  if (Object.keys($set).length === 0) {
    console.log("\nNothing to do.");
  } else if (DRY_RUN) {
    console.log("\n--dry-run: nothing written.");
  } else {
    const result = await settings.updateOne({ _id: doc._id }, { $set });
    console.log(`\nModified ${result.modifiedCount} document(s).`);

    const after = await settings.findOne({ _id: doc._id });
    console.log(
      `Priced ZIPs now    : ${Object.keys(after.deliveryZones?.customFees ?? {}).length}`,
    );
  }

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
