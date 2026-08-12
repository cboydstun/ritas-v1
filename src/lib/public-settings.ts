import dbConnect from "@/lib/mongodb";
import { Settings } from "@/models/settings";

/**
 * The public, whitelisted view of the admin settings singleton.
 *
 * Server components read this directly. `/long-term-lease` used to HTTP-fetch
 * its own `/api/v1/settings` route through `NEXTAUTH_URL`, which made the page
 * fully dynamic and — if that variable was ever unset or wrong — silently
 * rendered the default lease tiers and hid the documentation PDF, with the
 * failure swallowed by a bare catch.
 */
export interface PublicSettings {
  fees?: Record<string, number | undefined>;
  machines?: Record<string, { basePrice?: number } | undefined>;
  mixers?: Record<string, unknown>;
  extras?: Record<string, unknown>;
  operations?: Record<string, number | undefined>;
  leaseTiers?: Record<string, unknown>;
  documentation?: { pdfUrl?: string; pdfLabel?: string };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  await dbConnect();

  // No document yet means "schema defaults", not "no settings" — a
  // non-persisted instance gives callers the same shape either way.
  const settings =
    (await Settings.findOne({ key: "global" })) ?? new Settings({});
  const doc = settings.toObject();

  // `machines` carries per-type `inventory` alongside `basePrice`; only the
  // price is any of the browser's business.
  const machines = Object.fromEntries(
    Object.entries(doc.machines ?? {}).map(([type, config]) => [
      type,
      { basePrice: (config as { basePrice?: number })?.basePrice },
    ]),
  );

  return {
    fees: doc.fees,
    machines,
    mixers: doc.mixers,
    extras: doc.extras,
    operations: doc.operations,
    leaseTiers: doc.leaseTiers,
    documentation: doc.documentation,
  };
}
