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

/** Admin `Settings.extras` / `Settings.mixers` shape — both are Mixed maps. */
export type PriceOverrides = Record<string, { price?: number } | undefined>;

export interface CatalogOverrides {
  extras?: PriceOverrides;
  mixers?: PriceOverrides;
}

/** The id an extra-mixer add-on carries in `selectedExtras`. */
export function mixerExtraId(mixer: string): string {
  return `mixer-${mixer}`;
}

/**
 * Every add-on that may legitimately appear in `selectedExtras`, keyed by id:
 * the four static items plus one "extra mixer" entry per mixer flavour.
 * Admin price overrides are folded in here so callers get final prices.
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

  for (const [mixer, details] of Object.entries(mixerDetails) as [
    MixerType,
    (typeof mixerDetails)[MixerType],
  ][]) {
    const id = mixerExtraId(mixer);
    // An admin can price the add-on either as an extra or via the mixer itself;
    // an explicit `extras` entry is the more specific of the two, so it wins.
    const override =
      overrides?.extras?.[id]?.price ?? overrides?.mixers?.[mixer]?.price;
    catalog.set(id, {
      id,
      name: `${details.label} — Extra Mixer`,
      description: details.description,
      price: typeof override === "number" ? override : details.price,
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
