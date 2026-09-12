# Port the bounce-v3 delivery-zone rules into SATX Ritas

Target repo: `~/coding/ritas-v1` (Next.js 16 App Router, React 19, Mongoose 9, Tailwind 4).
Source of the design: `~/coding/bounce-v3` (`src/app/admin/delivery-zones/`, `src/lib/delivery/`, `src/utils/deliveryZones.ts`).

## Context

SATX Ritas prices delivery as **one flat `$20`** (`Settings.fees.deliveryFee`, default in three places) and decides who it delivers to with a **hardcoded 120-entry ZIP array** compiled into a client bundle (`isBexarCountyZipCode`, `src/components/order/utils.ts:65-107`). The two facts are unrelated to each other: a machine going to 78163 costs the same to deliver as one going four blocks, and the service area can only be changed by a deploy. There is no order minimum anywhere in the repo.

bounce-v3 solved exactly this and the solution has been in production for two years, with the failure modes written into its code as comments. The model:

> `Settings.deliveryZones.customFees` (zip → dollars) is **the only price and the only definition of the service area**. A zip absent from that map is not delivered to — which is a different state from a fee of `$0`. `insideZips`/`outsideZips` are **geography only**; membership implies no price. The **order minimum is derived, never stored per zip**: the zip's own fee falls into one of five bands, and each band carries a dollar floor.

The intended outcome: an admin prices any ZIP from a map in the browser, the checkout charges that ZIP's own figure, a ZIP nobody priced is refused rather than delivered to free, and every public sentence about delivery stops claiming a flat fee.

**Decisions already made** (asked and answered before this plan):

- Full parity — per-zip fees, zone geography, fee bands **and** tier order minimums.
- Port the Google map too, not a table-only admin.
- Seed every ZIP `isBexarCountyZipCode` currently accepts at **$20** — day-one pricing is byte-identical to today.
- Rewrite the customer copy **and** add a copy-lint test.

## Two deliberate departures from bounce-v3

1. **`DEFAULT_TIER_MINIMUMS` ships as all zeros, not `100/200/300/400/500`.** bounce-v3 shipped that ladder as a schema default, it became production policy by accident, and measured against twelve months of history it refused **174 of 572 orders (30%)**. Ritas has never measured a floor. Zero means "no floor" everywhere, the engine is inert until an admin types a number, and there is nothing to un-refuse. Same reason `fees.minOrderAmount` defaults to `0` rather than `100`.
2. **The 190KB ZCTA boundary file is served from `public/`, not imported.** bounce-v3 imports `src/data/zipCodeBoundaries.ts` into the client graph. In Ritas it becomes `public/data/zip-boundaries.json`, fetched by the map component alone, so it never enters a JS bundle and never affects the CI build.

---

## Phase 1 — The engine (pure modules + storage). No behaviour change.

New files, all copied structurally from bounce-v3 and adapted:

| New file                           | Ported from                                       | Responsibility                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/delivery/feeBuckets.ts`   | `bounce-v3 src/lib/delivery/feeBuckets.ts`        | `FeeBucketId = free\|low\|standard\|high\|premium\|unserviced`, `FEE_BUCKETS` as `satisfies Record<…>`, `FEE_BUCKET_ORDER`, `bucketForFee`. Keep the hex fills (Google Maps, not Tailwind) and the **top-inclusive** edges: `$50` is `standard`, `$50.01` is `high`. `null`/`NaN` → `unserviced`, never `free`. |
| `src/lib/delivery/zones.ts`        | `bounce-v3 src/utils/deliveryZones.ts`            | `DeliverySettings`, `customFeeFor`, `resolveZipFee`, `getDeliveryFee`, `getDeliveryZoneInfo`. Drop everything named `Loop1604`; the inside/outside predicates become `isInsideZone`/`isOutsideZone`.                                                                                                            |
| `src/lib/delivery/tierMinimums.ts` | same path in bounce-v3                            | `TierMinimums`, `DEFAULT_TIER_MINIMUMS` (**all `0`**), `TIER_MINIMUM_ORDER`, `minimumForFee`, `minimumForZip`, `formatMinimum`, `minimumOrderNotice`, `minimumOrderError`.                                                                                                                                      |
| `src/lib/delivery/zipFeeRows.ts`   | same path in bounce-v3                            | `buildZipFeeRows(zones)` → one row per **configured** zip. Derive the row set from `customFees ∪ insideZips ∪ outsideZips` only — do **not** pull it from the boundary data (that is the departure above).                                                                                                      |
| `src/lib/delivery/defaultZones.ts` | `bounce-v3 src/constants/defaultDeliveryZones.ts` | Seed-only `DEFAULT_INSIDE_ZIPS` / `DEFAULT_OUTSIDE_ZIPS`, derived from the ZIP list currently inside `isBexarCountyZipCode`. Runtime always reads Mongo.                                                                                                                                                        |

`customFeeFor` is the load-bearing one and must be copied verbatim in spirit:

```ts
const value = fees instanceof Map ? fees.get(zip) : fees[zip];
return typeof value === "number" && !Number.isNaN(value) ? value : null;
```

`Settings.getSettings()` hands a server caller a Mongoose `Map`; the browser gets a plain object. `fees["78209"]` on a Map is silently `undefined`, which reads as "not serviced" rather than as a bug.

### Storage — `src/models/settings.ts`

Add two paths to the singleton:

```ts
fees: { …, minOrderAmount: { type: Number, default: 0, min: 0 } },
deliveryZones: {
  customFees:  { type: Map, of: Number, default: {} },
  insideZips:  { type: [String], default: DEFAULT_INSIDE_ZIPS },
  outsideZips: { type: [String], default: DEFAULT_OUTSIDE_ZIPS },
  tierMinimums: {                     // five explicit Number fields, NOT a Map,
    free:     { type: Number, default: 0, min: 0 },   // so the schema validates
    low:      { type: Number, default: 0, min: 0 },   // the key set the way
    standard: { type: Number, default: 0, min: 0 },   // `satisfies TierMinimums`
    high:     { type: Number, default: 0, min: 0 },   // does in TypeScript
    premium:  { type: Number, default: 0, min: 0 },
  },
},
```

Extend `SettingsDocument` (`src/models/settings.ts:209-246`) to match.

### Public projection — `src/lib/public-settings.ts`

Add `deliveryZones` and `fees.minOrderAmount` to `PublicSettings` and to the returned object.

**`getPublicSettings` currently calls `settings.toObject()` (`public-settings.ts:30`), which leaves a Mongoose `Map` as a `Map`, and `JSON.stringify` renders that as `{}`.** The public fee map would reach the browser empty and every ZIP would read as unserviced. Switch that line to `settings.toObject({ flattenMaps: true })` (bounce-v3 calls `toJSON()` for the same reason, `src/lib/settings/publicSettings.ts:62-68`) and add a test that a settings document holding fees serialises them through `JSON.parse(JSON.stringify(...))`.

### Tests (`src/lib/delivery/__tests__/`)

Port bounce-v3's suites near-verbatim — `src/lib/` is held to **90/85/92/91** coverage in `jest.config.js`, so these are not optional:

- `feeBuckets.test.ts` — absent fee is `unserviced` never `free`; `0` is `free`; top-inclusive edges; every bucket has a distinct fill so two fees cannot read alike.
- `tierMinimums.test.ts` — a configured `0` is honoured (not read as absent); an unconfigured tier falls back to **the caller's number, never to `DEFAULT_TIER_MINIMUMS`**; `minimumForZip` accepts ZIP+4 and falls back for a listed-but-unpriced zip.
- `zones.test.ts` — `resolveZipFee` through a plain object **and a `Map`**; listed-but-unpriced → `unserviced`; off-list-but-priced → `custom`; empty/short zip.
- `src/models/__tests__/deliveryZonesPersist.test.ts` — ported from `tierMinimumsPersist.test.ts`. **Assert through the raw driver, never through the model.** Schema defaults are applied on hydration, so a document holding no ladder reads back through Mongoose as a complete one; bounce-v3 shipped a self-migration that did nothing and passed its tests for exactly that reason.

---

## Phase 2 — Admin write verbs + seed. Run the seed in production at the end of this phase.

### `PUT /api/admin/settings` (`src/app/api/admin/settings/route.ts`)

Three things must change together, and missing any one of them fails silently:

1. Add `"deliveryZones"` to `EDITABLE_SETTINGS_FIELDS` (`:10-18`).
2. Add the subtree to `settingsUpdateSchema` (`src/lib/validation.ts:267+`). **The zod schema is the only validation on this path** — `findOneAndUpdate` + `runValidators` runs path validators only. Validate: `customFees` a record whose every key matches `/^\d{5}$/` and whose every value is finite and `>= 0`; `insideZips`/`outsideZips` arrays of 5-digit strings; `tierMinimums` a partial object over the five priced bucket ids only (an unknown key, `unserviced` included, is a 400).
3. Add the narrow verbs below.

**Add `PATCH /api/admin/settings`** carrying the four narrow verbs, rather than widening `PUT`:

| Verb                 | Body                            | Effect                                                                                  |
| -------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `setCustomZipFee`    | `{ zipCode, fee }`              | `fees.set(zip, fee)` on the stored Map, then `markModified("deliveryZones.customFees")` |
| `removeCustomZipFee` | `"78015"`                       | `fees.delete(zip)` — **deletes the key, never writes `0`**                              |
| `updateZipLists`     | `{ insideZips?, outsideZips? }` | assigns each present array independently                                                |
| `updateTierMinimums` | `{ [tier]: number }`            | merged `{ ...DEFAULT, ...stored, ...patch }`                                            |

Why narrow verbs and not "resend the map": `customFees` is a wholesale assignment. In bounce-v3 the admin page had to rebuild all 90 entries from whatever the browser had loaded, so **pricing one zip reverted every fee written since that page load** and destroyed a verified production seed. The verbs mutate the stored Map in place. This is written into `~/.claude/.../memory/admin-customfees-write-clobbers.md`.

The verbs need a document to mutate, so use `findOne({key:"global"})` + `save()` (not `findOneAndUpdate`), creating the singleton if absent. Keep `guardAdminWrite` and the `{ message }` error shape; sessions still checked with `getServerSession(authOptions)` + `role === "admin"`.

### `scripts/delivery/seed-zip-fees.mjs`

Raw `mongodb` driver, **not** Mongoose — bypassing hydration defaults is the entire point. Reads `MONGODB_URI` from env or `.env.local`, supports `--dry-run`, idempotent and additive (`$set` only where the key is absent, so a re-run cannot flatten a retuned fee back to $20).

Seeds, on the one `{key:"global"}` document:

- `deliveryZones.customFees` — every ZIP in today's `isBexarCountyZipCode` list at `20`. That is 78201-78299 (99) plus the 21 named extras = **120 entries**. Duplicate the list into the `.mjs` locally; a script cannot import the TS module.
- `deliveryZones.insideZips` / `outsideZips` — the 78201-78299 block inside, the 21 outlying ZIPs outside. Geography, no price implied.
- `deliveryZones.tierMinimums` — the all-zero ladder, written explicitly so the stored document is complete.

**Run it against production before Phase 4 ships.** Verify with the Mongo MCP (`preconfigured` connection points at bounce-v3's Atlas; Ritas needs its own URI — check before assuming) or with `--dry-run` twice: the second run must report zero writes.

---

## Phase 3 — Admin UI: `/admin/delivery-zones`

New route `src/app/admin/delivery-zones/page.tsx` (client component), plus `src/components/admin/delivery-zones/`. `admin` is already in `RESERVED_PREFIXES` (`src/lib/landing.ts:314`), so `reserved-paths.test.ts` will not fire. Add the nav entry to `src/components/admin/AdminLayout.tsx` (hrefs at `:35-95`) — a page with no nav link is a page nobody finds. Use `src/components/admin/form-styles.ts` (`inputClass`, `labelClass`, `rowButtonClass`) for every input.

### Modules

- `src/app/admin/delivery-zones/zipLists.ts` — pure, no React, ported verbatim from bounce-v3. `zipListsFromSettings` (returns `null` when unloaded — never serialise `null` as `[]`), `ZipZone = "inside" | "outside" | null` (`null` is a reachable state: a priced zip on neither list), `zoneOf`, `setZipZone` (never mutates its input), `nextZone` (inside → outside → none → inside), `zipInventory`, and `unpricedListedZips` — the "looks covered, refused at checkout" detector.
- `useDeliveryZones` hook — GETs `/api/admin/settings`, exposes `saveCustomFee` / `removeCustomFee` / `saveZipLists` / `saveTierMinimums`, each PATCHing **only its own slice**, mirroring into local state, returning `boolean` and never throwing.
- `ZipInventoryPanel` — one row per configured zip, zone as a clickable cycling badge, prefix filter. Header counts say **serviced = priced only**, deliberately not `inventory.length`. Top block is the red unpriced-listed-zip warning: _"N zips are listed with no fee / Checkout refuses orders to these zips. Click one to give it a fee."_
- `ZoneLegendPanel` — `Band | Fee · zips | Min. order`, one `<input type=number min=0 step=5>` per **priced** bucket; `unserviced` shows the word "fallback". Save button appears only when the draft is dirty.
- `ZipDetailPanel` — fee input is `value={fee ?? ""}` with placeholder `none`; Save disabled while `null`. A read-only "Minimum order" row computed from the **typed** fee via `minimumForFee`, so typing moves the minimum before saving. Remove-fee takes an inline confirm: _"Remove 78xxx's fee? It leaves the service area — checkout will refuse orders to this zip."_
- `GoogleDeliveryZoneMap` — receives prebuilt `rows` + `styleByZip`, calls `onZipClick(zip, fee|null, zoneName)`. Loads the Maps JS API and fetches `/data/zip-boundaries.json`.

### Guard rails that must survive the port

These are the parts that are not obvious and that bounce-v3 learned the hard way:

- **A failed first load renders nothing** — not defaults. A hook that seeds a hardcoded literal would show an unstored ladder as if it were stored, and one band edit would PATCH all five over production. A _save_ error, by contrast, renders as a banner over the still-drawn map.
- **The fee input's empty value is `null`, never `0`.** `$0` is a real price; pre-filling it made free delivery the one-click default for an unpriced zip.
- **The tier-minimums editor is a local draft saved on a button**, and its adopt-effect is keyed on a _value_ string, not object identity:
  ```ts
  const key = TIER_MINIMUM_ORDER.map((id) => stored[id]).join("|");
  useEffect(() => {
    setDraft(stored);
  }, [key]);
  ```
  Keyed on identity, saving a zip fee resets an in-progress ladder edit.
- `buildZipFeeRows` is memoised on `settings.deliveryZones` identity alone, so a keystroke in a fee input cannot tear down ~120 polygons.

### Map plumbing (the only new infrastructure)

1. `public/data/zip-boundaries.json` — converted from `bounce-v3 src/data/zipCodeBoundaries.ts` (190KB) to plain JSON: `{ [zip]: { name, centroid: [lng,lat], coordinates: [lng,lat][] } }`. Fetched by the map component; never imported.
2. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — new, add to `.env.sample`, `.env.local` and all three Vercel environments. Must be a browser key with an HTTP-referrer restriction.
3. **CSP** (`next.config.ts:68-84`). `*.google.com` and `*.gstatic.com` are already allowlisted in `script-src`, `img-src` and `connect-src`; **`maps.googleapis.com` is not** — `*.googleapis.com` is absent from every directive. Add `https://*.googleapis.com https://googleapis.com` to those three. `style-src` already carries `'unsafe-inline'`, which the Maps SDK needs. A missing entry here fails **silently** — the map renders blank with no error on our side, which is the exact shape of the two analytics outages the comments above that policy describe.
4. Update `__tests__/security-headers.test.ts`, which pins the host symmetry across directives.

---

## Phase 4 — The pricing path and the trust boundary

### `computeOrderTotal` (`src/components/order/utils.ts:173-269`) — one source of truth, both sides

`calculatePrice` takes `deliveryFee` from `settings.fees.deliveryFee` (`src/lib/pricing.ts:39`). Resolve it from the ZIP instead, inside `computeOrderTotal`, before the `calculatePrice` call:

```ts
const zip = formData.customer.address.zipCode;
const resolvedDeliveryFee = getDeliveryFee(zip, settings?.deliveryZones);
```

`getDeliveryFee` returns `resolveZipFee(...).fee ?? 0`. The `?? 0` exists to keep `NaN` out of a total when the service-area gate has been bypassed — it is **not** the gate. The gate is Phase 4's refusal, below.

Also **add `rentalSubtotal` to `OrderTotals`**: `roundCurrency(perDayRate * rentalDays + extrasTotal)` — machine and extras, **excluding delivery**. That is what the minimum is measured against. The delivery fee is the cost the minimum exists to cover, so it must not be what clears it; without this a $92 cart qualifies for a $100 minimum by being delivered somewhere expensive.

### Service-area gate

Replace the body of `isBexarCountyZipCode` (`src/components/order/utils.ts:65-107`) with the settings-driven predicate and **rename it `isServicedZipCode`** — "Bexar County" is precisely the false geography claim Phase 5 removes from the copy, and there are only three call sites:

```ts
export const isServicedZipCode = (zip: string, settings?: DeliverySettings) =>
  !!zip && customFeeFor(settings, zip.replace(/\D/g, "").slice(0, 5)) !== null;
```

**Priced is serviced — that is the whole rule.** It goes through `customFeeFor`, not `customFees[zip]`, so a server-side Map caller is not silently told "not serviced". Keep the ZIP+4 digit-strip; bounce-v3 and Ritas both once turned away every valid ZIP+4 in the county.

Call sites: `DetailsStep.tsx:132-135,317,328,398-483` (needs the settings prop threaded in — `OrderForm` already fetches them at `:104-147`), `OrderForm.tsx:595-597`, and `save-booking/route.ts:153-161`.

### `POST /api/save-booking` — the trust boundary

Already unauthenticated by design and already refuses to accept a price from the body (`rentalDataSchema` is `.strip()`). Three additions, in this order, after the existing settings read at `:109-130`:

1. **Service-area refusal.** `resolveDeliveryFee(zip, settings.deliveryZones)` — new `src/lib/delivery/resolveDeliveryFee.ts`, ported from `bounce-v3 src/lib/orders/resolveDeliveryFee.ts`. `{ ok: false, code: "unserviced-zip" }` → `400 { message }`. An unpriced ZIP is **refused**, never priced through `getDeliveryFee`'s `?? 0`, which would grant free delivery to a ZIP nobody set a price for.
2. **Fee from the ZIP, not the request.** Pass the resolved fee into `computeOrderTotal`. Ritas is already safe here — the body carries no fee — but the resolution must be the server's, not a settings default.
3. **Minimum gate**, after the authoritative recompute, against `totals.rentalSubtotal`, never `finalTotal`:
   ```ts
   const minimum = minimumForZip(zip, settings.deliveryZones, settings.fees?.minOrderAmount ?? 0);
   if (minimum > 0 && totals.rentalSubtotal < minimum)
     return 400 { message: minimumOrderError(minimum, zip, totals.rentalSubtotal) };
   ```

### Admin order routes

`POST /api/admin/orders` and `PUT /api/admin/orders/[id]` are **exempt from both** the service-area refusal and the minimum — the office quotes by phone. The exemption is the route's identity (session-derived, admin-only), never a body field. Note that these routes do not currently apply the ZIP gate at all, so this is a documentation of existing behaviour rather than a change.

`PUT` must keep repricing **only when a pricing input changed** (`route.ts:236-239,325-328`). Adding `customer.address.zipCode` to that trigger list is correct and necessary — moving an order to a different ZIP must reprice delivery — but do **not** widen it further. An unconditional recompute is the bug CLAUDE.md names outright.

### Tests

- `src/lib/delivery/__tests__/resolveDeliveryFee.test.ts`.
- `src/app/api/save-booking/__tests__/zipFee.test.ts` — prices a $75 ZIP at $75 whatever the client claims; refuses a ZIP with no fee anywhere; refuses a listed-but-unpriced ZIP; **the delivery fee does not help clear the minimum**; a tier of `0` is no floor; admin routes are exempt and **cannot be exempted from the public route by claiming it in the body**.
- `src/components/order/__tests__/rentalSubtotalMirror.test.ts` — the browser's `computeOrderTotal(...).rentalSubtotal` and the server's figure agree across single-day, multi-day and flat-vs-per-day-extra carts, with `deliveryFee` excluded from both. A cent of drift refuses at the API what the review screen approved, identically on every retry.

---

## Phase 5 — Customer surface and copy

### New components

- `src/components/DeliveryFeeChecker.tsx` — homepage ZIP lookup, beside or inside `MapSection`. Reads the same `getDeliveryZoneInfo` the checkout reads, so it cannot drift. Three outcomes: no surcharge / `$N surcharge` / outside the service area with a call-us button. Appends `minimumOrderNotice(minimum)` when the ZIP is serviced and the minimum is `> 0`. Fallback minimum is **`0`, deliberately** — an unbanded ZIP has no fee either, so it lands in "not serviced" and the zero is never displayed.
- `src/components/order/DeliveryFeeNotice.tsx` — in `DetailsStep`, under the ZIP field. Four branches: not available (red) / no surcharge (green, keyed on `fee === 0`, **not** on zone) / surcharge outside (amber) / surcharge inside (blue). Every branch that shows a fee also shows the minimum line.

### Copy rewrite

Per-zip pricing makes "a flat fee, no per-mile charge" false. Every one of these must change, and the DB-stored ones need a re-seed, not just an edit:

| Where                                                                                                           | Today                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/app/pricing/page.tsx:342-350, 485-488`                                                                     | "The delivery fee is a flat one-time charge" + a **hardcoded** "Delivery & Setup: $20.00 flat fee"                       |
| `src/lib/service-area-page.ts:32` (`DELIVERY_INCLUDES`, on all 16 area pages)                                   | "Delivery and pickup — a flat fee, no per-mile charge."                                                                  |
| `src/app/order/page.tsx:66`                                                                                     | "…with a flat one-time delivery fee."                                                                                    |
| `src/components/order/steps/DateSelectionStep.tsx:215`                                                          | "🚚 Flat-rate delivery & setup throughout Bexar County"                                                                  |
| `src/components/order/steps/DetailsStep.tsx:135,186,406,478-483`                                                | "We only deliver within Bexar County, TX."                                                                               |
| `src/app/api/save-booking/route.ts:157`                                                                         | "We currently deliver only within Bexar County."                                                                         |
| `src/lib/blog-seed.ts:63` (seeded, now in Mongo)                                                                | "Delivery is a flat fee inside Bexar County."                                                                            |
| `src/components/home/MapSection.tsx:64-70`, `src/app/faq/page.tsx:91-93`, `src/app/service-area/page.tsx:24-31` | three mutually inconsistent area claims — "Bexar County", "San Antonio metropolitan area", "within 30 miles of downtown" |

The replacement claim, used everywhere: **delivery is quoted per ZIP, up front, before you book.** The `/pricing` page stops hardcoding `$20` and reads the fee through `getPublicSettingsSafe` like the rest of it (that page is already `revalidate = 60` and already in `DB_BACKED_ROUTES`).

Re-seed the 16 `/service-area/*` landing rows and the blog row afterwards. Both are `$setOnInsert` upserts, so **a re-seed will not overwrite them** — the seed route creates rows it does not own. Either write a one-off update script or edit the rows through the admin. And seeding cannot bust ISR: the deploy does.

### `src/app/__tests__/deliveryCopy.test.ts`

Ported from bounce-v3. A source-text scan over the public copy files above **plus** `src/lib/service-area-page.ts` and `src/lib/blog-seed.ts`, with the file count pinned so a new public page cannot quietly escape the scan. Bans: `/flat[- ]?(fee|rate)/i`, `/no per-mile/i`, any unqualified "delivery is free" / "free delivery inside|within|throughout|across", and "we only deliver within Bexar County". Explicitly **not** scanned: the components that render an already-resolved per-ZIP fee, notification emails, and the whole admin tree.

---

## Verification

Per phase, and then end to end:

```bash
cd ~/coding/ritas-v1
npm run typecheck && npm run lint && npm run format:check
npm run test:ci          # note: coverage thresholds are a ratchet — raise, never lower
npm run build            # runs with an unreachable MONGODB_URI by design
```

`npm test` passes `--passWithNoTests`, so **check the reported test count** — a filter that matches nothing exits 0. `test:ci` does not, which is why it is the gate. Do not import `jest` from `@jest/globals` in any new test file; it defeats SWC's `jest.mock` hoisting and the mock silently does nothing. Route tests need `/** @jest-environment node */` and the usual mocks (`@/lib/mongodb`, `next-auth/next`, `@/lib/auth`, `next/cache`, the model module) — copy the header from `src/app/api/admin/service-area-seed/__tests__/route.test.ts:1-20`.

End to end, against a local dev server with a **local** Mongo (`.env.local` points at production):

1. `/admin/delivery-zones` draws the map and lists 120 serviced ZIPs, all `low` band, all `$20`.
2. Price 78006 at `$75` → it moves to the `high` band and its colour changes without a reload. Re-open the page: still `$75`. Price a second ZIP, reload: **both** survive (this is the clobber regression).
3. Set the `high` tier minimum to `$200`, Save, reload — it persists. Confirm through the raw driver that the value is **stored**, not merely hydrated.
4. Remove 78163's fee. It drops out of "serviced" and — if it is still on a zone list — appears in the red unpriced warning.
5. Checkout to 78006: the summary shows `$75`, not `$20`. Checkout to 78163: refused at the ZIP field, and a direct `curl` at `/api/save-booking` with that ZIP is refused too.
6. Checkout a $150 single machine to 78006 with the `$200` high minimum set: refused, quoting the same sentence the review screen showed. Add a second day: accepted.
7. `curl localhost:3000/api/v1/settings | jq .deliveryZones.customFees` — a populated object, **not `{}`** (the `flattenMaps` check).
8. `grep -rn "flat fee\|per-mile\|only deliver within Bexar" src/` returns nothing outside tests.

## Sequencing note

**The seed must run in production before Phase 4 deploys.** Phase 4 is the phase that starts refusing an unpriced ZIP; if the fee map is empty when it lands, every booking is refused. Phases 1-3 are inert by construction — nothing reads `deliveryZones` on the pricing path until Phase 4 — so they can ship in any order ahead of it. Ritas deploys from green CI on `main` in this repo's sibling (`.github/workflows/ci.yml` runs typecheck, lint, format:check, test:ci, build), so confirm the seed landed in production **before** merging Phase 4, not after.

## Also worth doing, and out of scope here

Commit this spec into the Ritas repo as `docs/delivery-zones-port.md` before starting, so the reasoning above travels with the code rather than living in a plan file.
