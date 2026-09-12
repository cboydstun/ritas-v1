/**
 * Zone-membership algebra for the delivery-zone admin page.
 *
 * Pure, no React, no imports from the panel components — the map component
 * loads the Maps SDK at module scope, so nothing that shares a file with it can
 * be unit tested. Same split `src/lib/delivery/zipFeeRows.ts` makes.
 */

export type DeliveryZoneName = "inside" | "outside";

export interface ZipLists {
  inside: string[];
  outside: string[];
}

interface DeliveryZoneSettings {
  insideZips?: string[];
  outsideZips?: string[];
}

/**
 * Both lists come from one loaded settings document, so a write can only be
 * built from a pair we actually hold.
 *
 * `null` means "not loaded". Serialising that as `[]` tells the server the
 * admin emptied the list — and the server obliges, because an empty zone is a
 * legitimate saved state.
 */
export function zipListsFromSettings(
  zones: DeliveryZoneSettings | undefined,
): ZipLists | null {
  const inside = zones?.insideZips;
  const outside = zones?.outsideZips;
  if (!Array.isArray(inside) || !Array.isArray(outside)) return null;
  return { inside, outside };
}

/**
 * Which zone list holds a ZIP, or `null` for neither.
 *
 * `null` is a real, reachable state rather than a gap: a ZIP can be priced and
 * serviced while sitting on neither list. Zone membership is **geography** — it
 * decides the badge and the polygon's label — and never a price.
 */
export type ZipZone = DeliveryZoneName | null;

/** Which list holds the ZIP, if either. */
export function zoneOf(lists: ZipLists, zip: string): ZipZone {
  if (lists.inside.includes(zip)) return "inside";
  if (lists.outside.includes(zip)) return "outside";
  return null;
}

/** Put the ZIP on one list, the other, or neither. Never mutates its input. */
export function setZipZone(
  lists: ZipLists,
  zip: string,
  zone: ZipZone,
): ZipLists {
  // Re-selecting the zone a ZIP already holds is a no-op, identity included.
  // The badge cycles through ZIPs already on screen, so without this a stray
  // click would move the ZIP to the end of its own list and repaint the panel.
  if (zoneOf(lists, zip) === zone) return lists;

  const without = {
    inside: lists.inside.filter((z) => z !== zip),
    outside: lists.outside.filter((z) => z !== zip),
  };
  if (zone === null) return without;
  return zone === "inside"
    ? { ...without, inside: [...without.inside, zip] }
    : { ...without, outside: [...without.outside, zip] };
}

/** The order the row badge cycles through when it is clicked. */
export function nextZone(zone: ZipZone): ZipZone {
  if (zone === "inside") return "outside";
  if (zone === "outside") return null;
  return "inside";
}

/**
 * Every ZIP the admin has configured, once each, with its zone attached.
 *
 * A ZIP is *configured* when it carries a fee or appears on a zone list. A
 * polygon nobody has priced or listed is not inventory — the map paints it grey
 * and clicking it is how it gets a fee — while a listed ZIP with no fee has to
 * be here, because that is precisely what `unpricedListedZips` warns about, and
 * a warning pointing at rows that are not on screen is no warning.
 */
export function zipInventory<T extends { zipCode: string; fee: number | null }>(
  rows: readonly T[],
  lists: ZipLists | null,
): (T & { zone: ZipZone })[] {
  const inside = new Set(lists?.inside ?? []);
  const outside = new Set(lists?.outside ?? []);

  return rows
    .filter(
      (row) =>
        row.fee !== null || inside.has(row.zipCode) || outside.has(row.zipCode),
    )
    .map((row) => ({
      ...row,
      zone: inside.has(row.zipCode)
        ? ("inside" as const)
        : outside.has(row.zipCode)
          ? ("outside" as const)
          : null,
    }))
    .sort((a, b) => a.zipCode.localeCompare(b.zipCode));
}

/**
 * The ZIPs a zone list claims to cover that have no fee of their own.
 *
 * Zone membership implies no price, so this is the one way a ZIP can look
 * covered and be refused at checkout: it is on a list, so it reads as serviced,
 * but `resolveZipFee` answers `unserviced` because nothing priced it. Adding a
 * ZIP to a list is the only way to create the state, which is why the panel
 * that does the adding is where the warning belongs.
 */
export function unpricedListedZips<
  T extends { zipCode: string; fee: number | null },
>(rows: readonly T[], listed: ReadonlySet<string>): T[] {
  return rows.filter((row) => listed.has(row.zipCode) && row.fee === null);
}

/** Every ZIP on either zone list. */
export function listedZips(lists: ZipLists | null): ReadonlySet<string> {
  return new Set([...(lists?.inside ?? []), ...(lists?.outside ?? [])]);
}
