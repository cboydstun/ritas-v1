import { extraItems, type ExtraItem } from "@/components/order/types";
import { mixerDetails, type MixerType } from "@/lib/rental-data";

/**
 * Server-side source of truth for add-on pricing.
 *
 * The order form posts a `selectedExtras` array, and until this module existed
 * `computeOrderTotal` read `price` and `pricingType` straight off those objects
 * whenever the id had no admin override — so a crafted request could name its
 * own price (including a negative one) and the "server-side recompute" would
 * faithfully recompute from it. Prices now always come from this catalog; the
 * request body may only choose an id and a quantity.
 */

export const MAX_EXTRA_QUANTITY = 20;

/** Admin `Settings.extras` shape — a Mixed map of id → price. */
export type PriceOverrides = Record<string, { price?: number } | undefined>;

/**
 * Admin `Settings.mixers` shape. An admin can add flavours here that have no
 * entry in the static `mixerDetails`, so this carries the display metadata too.
 */
export type MixerOverrides = Record<
  string,
  { label?: string; description?: string; price?: number } | undefined
>;

export interface CatalogOverrides {
  extras?: PriceOverrides;
  mixers?: MixerOverrides;
}

/** The id an extra-mixer add-on carries in `selectedExtras`. */
export function mixerExtraId(mixer: string): string {
  return `mixer-${mixer}`;
}

/**
 * Every add-on that may legitimately appear in `selectedExtras`, keyed by id:
 * the static items plus one "extra mixer" entry per mixer flavour.
 *
 * Mixers are enumerated from the admin `Settings.mixers` map when one is
 * supplied, falling back to the static `mixerDetails`. Enumerating only the
 * static four meant an admin-added flavour rendered a card in the extras step
 * that priced at $0 and then failed checkout with "not available".
 */
export function buildExtrasCatalog(
  overrides?: CatalogOverrides,
): Map<string, ExtraItem> {
  const catalog = new Map<string, ExtraItem>();

  for (const item of extraItems) {
    const override = overrides?.extras?.[item.id]?.price;
    catalog.set(item.id, {
      ...item,
      price: typeof override === "number" ? override : item.price,
      quantity: 1,
    });
  }

  const staticMixers = mixerDetails as Record<
    string,
    (typeof mixerDetails)[MixerType] | undefined
  >;
  const mixerIds = new Set<string>([
    ...Object.keys(staticMixers),
    ...Object.keys(overrides?.mixers ?? {}),
  ]);

  for (const mixer of mixerIds) {
    const details = staticMixers[mixer];
    const settingsMixer = overrides?.mixers?.[mixer];
    const id = mixerExtraId(mixer);

    const label = settingsMixer?.label ?? details?.label ?? mixer;
    const description =
      settingsMixer?.description ?? details?.description ?? "";
    // An admin can price the add-on either as an extra or via the mixer itself;
    // an explicit `extras` entry is the more specific of the two, so it wins.
    const price =
      overrides?.extras?.[id]?.price ?? settingsMixer?.price ?? details?.price;
    if (typeof price !== "number") continue;

    catalog.set(id, {
      id,
      name: `${label} — Extra Mixer`,
      description,
      price,
      allowQuantity: true,
      quantity: 1,
      pricingType: "flat",
    });
  }

  return catalog;
}

/**
 * Look up an add-on's unit price. Returns `undefined` for ids that aren't in
 * the catalog so callers can decide between rejecting and ignoring them.
 */
export function catalogPrice(
  id: string,
  overrides?: CatalogOverrides,
): number | undefined {
  return buildExtrasCatalog(overrides).get(id)?.price;
}

/**
 * Every mixer flavour that may legitimately appear in `selectedMixers`.
 *
 * The tank-mixer list the order form renders comes from `Settings.mixers`
 * (`OrderForm` -> `MachineStep`), so a flavour an admin adds is selectable in
 * the UI. Validating the submission against the static four rejected those
 * bookings at checkout with a raw Zod message — the same bug this module
 * already fixes for the extras path.
 */
export function buildMixerCatalog(overrides?: CatalogOverrides): Set<string> {
  return new Set<string>([
    ...Object.keys(mixerDetails),
    ...Object.keys(overrides?.mixers ?? {}),
  ]);
}

export interface ResolveMixersResult {
  mixers: string[];
  /** Ids present in the request that don't exist in the catalog. */
  unknownIds: string[];
}

/**
 * Validate an untrusted `selectedMixers` payload against the catalog.
 *
 * Order is significant — the array is positional, one entry per tank — and the
 * same flavour may legitimately repeat across tanks, so nothing is deduped or
 * reordered. Only unknown ids are split out for the caller to reject.
 */
export function resolveSelectedMixers(
  selected: unknown,
  overrides?: CatalogOverrides,
): ResolveMixersResult {
  if (!Array.isArray(selected)) {
    return { mixers: [], unknownIds: [] };
  }

  const catalog = buildMixerCatalog(overrides);
  const mixers: string[] = [];
  const unknownIds: string[] = [];

  for (const raw of selected) {
    if (typeof raw !== "string") continue;
    if (catalog.has(raw)) mixers.push(raw);
    else unknownIds.push(raw);
  }

  return { mixers, unknownIds };
}

export interface ResolveExtrasResult {
  extras: ExtraItem[];
  /** Ids present in the request that don't exist in the catalog. */
  unknownIds: string[];
}

/**
 * Turn an untrusted `selectedExtras` payload into canonical catalog items.
 *
 * Only `id` and `quantity` are read from the input. Everything else — name,
 * description, price, pricingType — comes from the catalog, and quantity is
 * clamped to a whole number in [1, MAX_EXTRA_QUANTITY] (or forced to 1 for
 * items that don't allow a quantity).
 */
export function resolveSelectedExtras(
  selected: unknown,
  overrides?: CatalogOverrides,
): ResolveExtrasResult {
  if (!Array.isArray(selected)) {
    return { extras: [], unknownIds: [] };
  }

  const catalog = buildExtrasCatalog(overrides);
  const extras: ExtraItem[] = [];
  const unknownIds: string[] = [];
  const seen = new Set<string>();

  for (const raw of selected) {
    if (!raw || typeof raw !== "object") continue;

    const { id, quantity } = raw as { id?: unknown; quantity?: unknown };
    if (typeof id !== "string") continue;

    const item = catalog.get(id);
    if (!item) {
      unknownIds.push(id);
      continue;
    }

    // A duplicated id would otherwise be billed twice.
    if (seen.has(id)) continue;
    seen.add(id);

    extras.push({ ...item, quantity: clampQuantity(quantity, item) });
  }

  return { extras, unknownIds };
}

function clampQuantity(quantity: unknown, item: ExtraItem): number {
  if (!item.allowQuantity) return 1;
  const n = Math.floor(Number(quantity));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_EXTRA_QUANTITY);
}
