# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run format       # Prettier (writes in place)
npm run format:check # Prettier (verify only, for CI)
npm test             # Jest (all tests)
npm run test:watch   # Jest watch mode
npm run test:machine # Run only machine-step tests
npm run test:coverage # Jest with coverage report
npm run test:ci      # Jest in CI mode with coverage
```

Run a single test file: `npx jest src/components/order/steps/__tests__/SomeTest.test.tsx`

`.github/workflows/ci.yml` runs `typecheck`, `lint`, `format:check`, `test:ci` and `build` on every push and PR to `main`. The build step is what gates static generation — 62 pages are prerendered, and a page that throws during prerender is a red deploy the other four gates all report green. It runs with a deliberately unreachable `MONGODB_URI`, because `src/lib/mongodb.ts` throws at import when the variable is absent while the one page that reads the database at build time catches the connection failure. `test:ci` deliberately does **not** pass `--passWithNoTests`, and `jest.config.js` carries `coverageThreshold`s set just under the measured coverage — raise them, do not lower them to get a build out. They had drifted to within 0.12 of a point of actual, which makes the next uncovered helper a red build for a reason unrelated to the change that tripped it; keep a point or two of headroom when you raise them.

Two jest footguns in this repo: importing `jest` from `@jest/globals` defeats SWC's `jest.mock` hoisting, so a `jest.mock("next/navigation", ...)` in such a file silently does nothing — use the global `jest`. And `nanoid` is ESM-only, so `transformIgnorePatterns` must keep transforming it.

Tests are co-located in `__tests__/` folders next to the code they cover. Jest is configured via `next/jest` with `jest-environment-jsdom`. The path alias `@/*` resolves to `src/*` (set in both `tsconfig.json` and `jest.config.js`). `npm test` passes `--passWithNoTests`, so a filter that matches nothing exits 0 — check the reported test count, don't trust a green exit alone. `test:machine` and `test:ci` deliberately do not, so a filter that stops matching is a failure rather than a silent pass.

Jest 30 renamed `--testPathPattern` to `--testPathPatterns`. `test:machine` carried the old spelling and so exited 1 without running anything, for as long as it took someone to run it — CI never does.

`npm run typecheck` (`tsc --noEmit`) is the fast type gate. `next.config.ts` sets `typescript.ignoreBuildErrors: false`, so `npm run build` type-checks too — do not flip it back to `true` to get a build out; fix the type.

`npm run lint` calls `eslint .` directly (`next lint` is removed in Next 16). `eslint.config.mjs` must keep its `ignores` entry for `.next/` — without it ESLint walks the build output and reports thousands of bogus errors in minified chunks. It uses eslint-config-next 16's native flat configs; do not reintroduce `FlatCompat`, which throws "Converting circular structure to JSON" against v16.

`react-hooks/set-state-in-effect`, `react-hooks/immutability` and `react-hooks/purity` (new in eslint-plugin-react-hooks 7) are set to **warn**. The triage is done: 24 warnings became 18, and the `purity` and `immutability` classes are gone. Four were genuine and were fixed (`OrderFormTracker` held two values in state that are never rendered; `DateSelectionStep` mirrored the parent's dates and synced them back with an effect; `CreateOrderModal` set `price` unconditionally). Six were an effect calling a `const` fetcher declared below it — the effects moved, they were not suppressed. The one true false positive, `ReviewStep`'s `window.location.href`, carries a targeted disable and the reason.

The remaining 18 are all `set-state-in-effect` and all benign: canonical `mounted` hydration guards, `setCurrentPage(1)` on a filter change, and conditionally-mounted form initialisation. **None loops, and there is no in-place state mutation anywhere in the set.** Do not add blanket disables to make the number zero.

**Styling is Tailwind 4.** There is no `tailwind.config.ts` — the theme lives in an `@theme` block in `src/app/globals.css`, and `postcss.config.js` loads `@tailwindcss/postcss` (nesting and vendor prefixing are built in, so there is no `autoprefixer`). Add a colour or keyframe by adding a `--color-*` / `--animate-*` custom property there. The dark variant is `@custom-variant dark (&:where(.dark, .dark *))`, matching the class next-themes puts on `<html>`.

`--color-margarita` (#4b7a0a) clears WCAG AA against white (5.14:1) but **not** against `--color-charcoal` (2.46:1). Anywhere the brand green is text or an icon on the dark surface, use `--color-margarita-dark` (#8ec63f, 6.20:1 on charcoal) via `dark:text-margarita-dark`. Never put `text-charcoal` on `bg-margarita` — that fails in both themes. Also: do not drive theme-dependent colour from `@media (prefers-color-scheme)`, because next-themes is class-based; a visitor on a dark OS who explicitly picks Light gets the dark value against a light background, which is what made body text invisible.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · MongoDB/Mongoose 9 · NextAuth.js v4 · Zod · Tailwind CSS 4

## Architecture

### Routing & Pages

`src/app/` uses the Next.js App Router. Public pages live at the root (`/order`, `/pricing`, `/long-term-lease`, etc.), plus a `/service-area` hub. The hub exists because the bare path was a 404 and the city pages linked only within their own region, leaving four disconnected islands.

**`src/app/[...slug]/page.tsx` is a root catch-all serving every database-backed landing page**, including the 16 `/service-area/[city]` URLs, which are now `LandingPage` documents rather than a route file (see **Landing Pages** below). Admin pages are under `src/app/admin/` and are protected by the proxy (`src/proxy.ts` — Next 16's rename of the middleware file convention). API routes are split between `src/app/api/v1/` (public) and `src/app/api/admin/` (auth-required). `/api/save-booking` (the public checkout) and `/api/cron/release-holds` sit outside both namespaces at `src/app/api/`.

Two customer-facing verticals share this codebase: **event rentals** (the `/order` wizard, `Rental` model) and **long-term commercial leases** (`/long-term-lease`, an inquiry form only — no payment, `LeaseInquiry` model).

### Multi-Step Order Form

The order flow (`/order`) is a single client component `src/components/order/OrderForm.tsx` that manages a 5-step wizard: date → machine → details → extras → review. Each step is lazy-loaded via `next/dynamic`. Form state is persisted to `localStorage` under key `satx-ritas-order-draft` so drafts survive page reloads. The draft carries a `version`; a mismatch discards it rather than merging. **Validate every field you restore** — `machineType` and both selection arrays reach `calculatePrice`, which _throws_ rather than defaulting, from inside a `useState` initialiser. An unchecked value took the whole order page into the error boundary, and "Try again" re-read the same draft, so it was unrecoverable without the visitor clearing localStorage. The `?machine=` query param is validated for the same reason. On mount, the form fetches `/api/v1/settings` to get dynamic overrides (mixer options, delivery window hours, pricing). The `StepProps` interface in `src/components/order/types.ts` is the contract between the parent form and each step component.

### Pricing

The single source of truth for all order totals is `computeOrderTotal()` in `src/components/order/utils.ts`. It wraps `calculatePrice()` from `src/lib/pricing.ts` and adds multi-day, extras, and discount logic:

- `perDayRate = basePrice + mixerPrice`
- `rentalDays = calculateRentalDays(rentalDate, returnDate)` — a `Math.max(1, …)` clamp over `spanInDays()` from `src/lib/dates.ts`, which diffs **UTC** calendar dates. Do not reintroduce a millisecond diff of local-midnight `Date`s: a DST fall-back day is 25 hours, which billed one night as two. There is one implementation now; it used to exist twice, with the comment recording that bug on only one copy.
- `subtotal = perDayRate × rentalDays + deliveryFee + extrasTotal` (machine rate is per-day; delivery is flat; each extra is per-day unless its catalog entry says `pricingType: "flat"`)
- `serviceDiscountAmount = subtotal × discountRate` — **retired**. No UI sets it and no server route accepts it from a request body; the field survives only for legacy bookings.
- `discountedSubtotal = subtotal − serviceDiscountAmount`

- `processingFee = discountedSubtotal × processingFeeRate`
- `salesTax = (discountedSubtotal + processingFee) × salesTaxRate` — the processing fee is a taxable line item, matching the QuickBooks invoice
- `finalTotal = discountedSubtotal + processingFee + salesTax`

Every money figure goes through `roundCurrency()` in `utils.ts`, not `Number(x.toFixed(2))`. `toFixed` rounds the _binary_ double, so a value that is an exact half-cent in decimal rounds down: a 489.50 subtotal produced a 14.68 processing fee against the invoice's 14.69, and the error cascaded into `salesTax` and `finalTotal`. QuickBooks rounds decimal half-up; so does this.

Extras prices always come from `buildExtrasCatalog()` in `src/lib/extras-catalog.ts` (the static items in `types.ts` plus one `mixer-*` entry per flavour). Mixer entries are enumerated from `Settings.mixers` when overrides are passed, so a flavour an admin adds in `/admin/settings` is a real, purchasable add-on; enumerating only the static four made those cards price at $0 and then fail checkout with a 400. Tank mixers work the same way: `buildMixerCatalog()`/`resolveSelectedMixers()` resolve `selectedMixers` against `mixerDetails` ∪ `Settings.mixers`, and `mixerIdSchema` in `validation.ts` only checks that an id is well-formed. Pinning the schema to the original four flavours meant a flavour an admin added rendered a selectable tank card and then 400'd at checkout. `computeOrderTotal` looks each `selectedExtras[].id` up in the catalog and **ignores any `price`/`pricingType` on the item itself** — those may have arrived in a request body. Any UI that renders extras line items must use the same catalog, or the lines will not sum to the total.

Default constants: delivery $20, sales tax 8.25%, processing 3%. Base machine prices come from `src/lib/rental-data.ts`. The `PricingOverrides` type in `src/lib/pricing.ts` and `SettingsOverrides` in `utils.ts` allow the admin `Settings` document to override any of these at runtime.

### Availability & Inventory

`isMachineAvailable()` in `src/lib/inventory.ts` is the single source of truth for "can this machine be booked". `GET /api/v1/availability?machineType=&date=&returnDate=` is a thin validating wrapper over it (`returnDate` optional, defaults to `date`). **`capacity` is derived from `machineType` via `MACHINE_CAPACITY`, never read from the query** — the overlap count filters by capacity while inventory is keyed off machineType alone, so a mismatched pair matched no rentals and reported a full date as available. The param is still accepted and ignored for older clients. The algorithm:

1. Expand `[rentalDate, returnDate]` into every `YYYY-MM-DD` day in range.
2. Reject if any day falls in a `BlackoutDate` range (`isDateBlackedOut`).
3. Look up the per-type unit count via `getMachineInventory()` — reads `Settings.machines[type].inventory`; reject outright if `0`.
4. Count overlapping `Rental` docs **per day** — `confirmed`, `in-progress` and `pending_payment` always count; `pending` counts only while newer than `STALE_HOLD_MINUTES`. Reject if any single day has `booked >= inventory`.

So a machine type is bookable while units remain, not simply because one rental exists. `DEFAULT_INVENTORY` in `inventory.ts` matches the `Settings` schema defaults (`single: 3, double: 3, triple: 2`) and applies only when no Settings document or configured value exists — keep the two in sync.

`isMachineAvailable` accepts an `excludeRentalId` option so a booking is not blocked by its own hold, and an `ignoreCreatedFrom` option that makes the post-write recheck asymmetric. `/api/save-booking` passes both to re-check after the write and roll back on oversell, which closes the check-then-write race on the last unit. The recheck must stay asymmetric: when it was symmetric, two racers for the last unit each saw the other and each rolled itself back, rejecting both customers and selling nothing.

A third option, `tieBreakId`, settles the same-millisecond case. `createdAt` comes from `default: Date.now`, so two requests constructed in the same tick each fell outside the other's `$lt` cutoff and both survived, putting inventory one over. The id comparison decides which of the two counts as having been there first.

**Only `pending` expires.** `releaseStaleHolds()` cancels `pending` holds older than `STALE_HOLD_MINUTES` (120); it runs from the `/api/cron/release-holds` Vercel cron (see `vercel.json`, guarded by `CRON_SECRET`) and again at the top of `/api/save-booking` as a safety net. `pending_payment` is the status a _submitted_ booking carries — the customer has a confirmation email and is invoiced out of band — and nothing promotes it to `confirmed` except a manual admin edit. Reaping it cancelled every real booking two hours after it was placed and put the machine back on sale. Do not add it back to either the reaper or the query-time cutoff.

`MachineStep.tsx` checks all three machine types **in parallel** on mount so every card shows live availability, greys out unavailable ones, and auto-switches the selection to another available type (priority `triple > double > single`) when the current pick is unavailable. `useAvailabilityCheck` (`src/hooks/useAvailabilityCheck.ts`) wraps the single-type fetch.

Admins manage blackout date ranges via `/admin/blackout-dates` → `GET/POST /api/admin/blackout-dates` and `DELETE /api/admin/blackout-dates/[id]`.

### Landing Pages

Admin-authored pages at arbitrary paths, served by the root catch-all
`src/app/[...slug]/page.tsx`. The 16 `/service-area/[city]` pages are seeded
instances of this; `src/app/service-area/[city]/page.tsx` **was deleted**,
because Next matches `[city]` before `[...slug]` and leaving it in place made
every seeded row unreachable.

Two models, both with a `Mixed` `sections` array: `LandingPage`
(`src/models/landingPage.ts`, keyed by `path`) and `SharedBlock`
(`src/models/sharedBlock.ts`, keyed by `slug`) — a run of sections written once
and inserted into many pages by `{ kind: "blockRef", blockSlug }`.

`src/lib/landing.ts` is the **zod-free, mongoose-free** shared module, the same
split `blog.ts` makes: the section types, the path helpers, `resolveSections`
and `defaultSection`, imported by the client editor _and_ the models _and_
`validation.ts`. It reuses `SLUG_PATTERN`/`slugify` from `blog.ts` rather than
declaring a second slug regex.

**Because `sections` is `Mixed`, the zod union in `validation.ts` is the only
real validation on it** — mongoose neither casts nor deep-validates it, and
`runValidators` on a query update runs path validators only, the same trap
documented on `settingsUpdateSchema`. Every writer goes through
`landingPageCreateSchema`, the seeder included. Writes replace the **whole**
array with `$set`, never a positional update. The models carry a shallow
`sectionShapeError` net for anything that reaches a document another way.

Recursion is impossible by construction, not by a depth limit: there are two
unions, `contentSectionSchema` (no `blockRef`) and `pageSectionSchema`. A block
validates against the former, so a cycle cannot be expressed.

Two section kinds deliberately store **no content**. `pricingCards` resolves
machine prices from `Settings` at render, and `nearbyAreas` computes its link
mesh from `SERVICE_AREAS` via `nearbyServiceAreas(slug)`. Flattening either
into stored JSON would freeze prices into the database and stop a newly added
area from joining the other pages' mesh.

**Reserved paths.** `isReservedPath()` refuses a write at a path a real route
owns — it would save and then never render. `service-area` is exact-reserved
(the hub owns it) but _not_ prefix-reserved, which is what lets the 16 city
pages live below it. Path validity is checked structurally, `SLUG_PATTERN` per
segment, which rejects dots for free — so `/og-image.jpg` can never be a
landing path and `public/` needs no entry.
`src/lib/__tests__/reserved-paths.test.ts` walks `src/app/` and fails if a
route exists the list does not cover. **That test, not the list, is what keeps
this honest when someone adds a route.**

**Seeding.** `POST /api/admin/service-area-seed`, driven by a button on
`/admin/landing-pages`. It upserts with **`$setOnInsert`, never `$set`**, so
re-running can never overwrite an admin's edits. It sits in its own namespace
on purpose: as a `landing-pages/seed/` child it would win precedence over the
`[...path]` catch-all and make a landing page at `/seed` unaddressable.

**The `SERVICE_AREAS` invariant has weakened, and this is the biggest cost of
the feature.** Adding an area to `src/lib/service-areas.ts` still gives it a
homepage link, a hub entry, a `generateStaticParams` entry and a sitemap entry
— but no longer a page, because the page lives in Mongo. **The new ritual is:
add the area, then click "Seed" on `/admin/landing-pages`.** CI cannot catch
the drift (it has no database), so the admin page renders a banner listing any
area with no page yet.

Two mitigations make the gap survivable. `generateStaticParams` unions the
database paths with `SERVICE_AREAS`, so a CI build against an unreachable Mongo
still prerenders all 16. And `getPublishedPageByPathSafe` falls back to
`serviceAreaFallbackPage()` in two cases: the read **threw**, or a service-area
path has **no stored document at all**. It does _not_ fall back when a document
exists but is not published — that is a deliberate unpublish, and resurrecting
it would make taking a page down impossible. `src/lib/service-area-page.ts`
builds both the seed and the fallback from one function, so they cannot drift.

`sitemap.ts` lists the published paths plus any service-area path with no
stored document, so it advertises exactly what returns 200.

**Draft preview** is `src/app/admin/preview/[...slug]/page.tsx`,
`dynamic = "force-dynamic"`, rendering the same `SectionRenderer`. It is under
`/admin/*` so the proxy authenticates it, `robots.ts` disallows it and
`AnalyticsGate` keeps GA4 off it. A `?preview=` param on the public route was
rejected: reading `searchParams` opts the route out of static rendering for
_every_ visitor.

Rich text is authored HTML rendered with `dangerouslySetInnerHTML`, the same
trust model as the blog — `hasDangerousHtml` is defense-in-depth, not a
sanitizer, and the control that matters is the admin session.

A root catch-all means every unrouted request could reach the database, so the
path-shape and reserved checks run **before** any I/O; a crawler probing
`/wp-login.php` costs no round trip. `SectionRenderer` returns `null` for a
kind it does not know, so a document written by a newer deploy cannot take a
page into the error boundary. Admin writes call `revalidatePath` through
`src/lib/landing-revalidate.ts`, always caught — it runs after the write has
committed, and a cache-API throw must not turn a successful save into a 500.

**A path rename does not redirect the old URL.** Same gap the blog has.

### Long-Term Lease Flow

`/long-term-lease` renders three tiers (`single-15`, `double-30`, `triple-45`) via `LeaseTierCard.tsx`. Baseline tier data lives in `src/lib/lease-data.ts` (`leaseTiers`); `mergeLeaseTiers(overrides)` shallow-merges the admin `Settings.leaseTiers` overrides on top, so pricing/specs are editable at runtime without a deploy. `LeaseInquiryForm.tsx` posts to `POST /api/v1/lease-inquiries` (stored in the `LeaseInquiry` model, `src/models/leaseInquiry.ts`); admins triage them at `/admin/lease-inquiries` → `GET /api/admin/lease-inquiries`, `PATCH/DELETE /api/admin/lease-inquiries/[id]`. `LEASE_BUSINESS_TYPES` and `LEASE_TERMS` in `lease-data.ts` are the form's dropdown sources.

### Database

MongoDB via Mongoose 9. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation.

Mongoose 9 middleware takes no `next` callback: a `pre` hook signals completion by returning and failure by **throwing**. Do not reintroduce `function (next)` — it type-errors, and the model's validation would silently never run. `src/models/__tests__/schemas.test.ts` exercises the real schemas offline (`doc.validate()` needs no connection) and is what catches a hook that stops firing. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`, `leaseInquiry.ts`. Every model uses the `mongoose.models.X || mongoose.model(...)` guard — keep that pattern or hot reload throws `OverwriteModelError`.

### Authentication (Admin)

NextAuth.js credentials provider with JWT session strategy (no database sessions). Config is in `src/lib/auth.ts`.

`package.json` carries an `overrides` entry pinning `nodemailer` to `^9.0.5`. next-auth v4 depends on a vulnerable range (six advisories, one high) purely for its email provider, which this app does not use — only `CredentialsProvider` is configured. **If an email provider is ever added, drop the override and check next-auth against nodemailer 9 first.** next-auth v5 is still beta and is not a fix for this.
The username comes from `ADMIN_USERNAME`; the password is checked against the bcrypt hash in `ADMIN_PASSWORD_HASH`. **There is no plaintext fallback** — `ADMIN_PASSWORD` was removed because it kept a second copy of the credential in the environment and let a typo'd or dropped hash silently downgrade admin auth to a plaintext compare. Without the hash, admin login is disabled. Both comparisons are constant-time and the credentials callback is IP rate-limited. Auth is enforced in two layers: `src/proxy.ts` uses `getToken()` to reject unauthenticated requests early — it requires both a token and `token.role === "admin"` (page requests redirect to `/admin/login`, API requests return 401) — and individual admin route handlers redundantly call `getServerSession(authOptions)` as defense-in-depth. The proxy also force-redirects HTTP→HTTPS in production via `x-forwarded-proto`, using the host from `SITE_URL` rather than the `Host` header (trusting the header made it an open redirect). Its matcher is scoped to `/admin/*` and `/api/admin/*` — widen it if `PERMANENT_REDIRECTS` ever gains a public-page entry.

### Checkout Flow

There is **no online payment**. `ReviewStep.tsx` posts to `POST /api/save-booking`, which is the public customer checkout endpoint (unauthenticated by design). It generates a `bookingId` via nanoid, persists a `Rental` with status `pending_payment`, and sends confirmation via Resend email + Twilio SMS. The customer is invoiced afterwards out-of-band.

The PayPal integration was removed — the component had no importers and its routes charged nobody. Only `Rental.paypalOrderId` and the `pending` status value remain, for historical documents.

`/api/save-booking` never trusts the request body for money:

- The body is parsed by `rentalDataSchema` (`src/lib/validation.ts`); unknown fields are stripped.
- `capacity` is **derived** from `machineType`, never read from the request.
- `selectedExtras` is re-resolved through `resolveSelectedExtras()` (`src/lib/extras-catalog.ts`); only `id` and `quantity` are honoured, prices come from the catalog, and unknown ids are a 400.
- `price` and `payment.amount` are both set from the server-side `computeOrderTotal`.
- `isServiceDiscount` is hard-coded `false`.

The admin order routes (`POST /api/admin/orders`, `PUT /api/admin/orders/[id]`) enforce the same invariants: an explicit field whitelist, `capacity` derived from `machineType`, extras re-resolved through the catalog, and `price` recomputed by `computeOrderTotal`. Both re-check `isMachineAvailable` before writing: `POST` on create, and `PUT` (with `excludeRentalId`) whenever an edit moves the machine type or the dates **or revives a cancelled order** — `PUT { status: "confirmed" }` on a cancelled booking put a unit back onto a date that may have filled up in the meantime. Neither route accepts `capacity` or `price` from the body, and both re-resolve `selectedMixers` through `resolveSelectedMixers`.

**`PUT` reprices only when the edit touches a pricing input** (`machineType`, `selectedMixers`, `selectedExtras`, `rentalDate`, `returnDate`). It used to recompute unconditionally, so `PUT { status }` from `OrdersTable`'s status control — or `PUT { payment }` from its payment-status control, which is the same request shape — repriced a months-old order at _today's_ `Settings`. Marking a payment collected was the precise action that rewrote the collected amount, leaving the stored total disagreeing with the confirmation email and the QuickBooks invoice. Historical orders keep the price they were sold at. When it _is_ a pricing edit, `payment.amount` follows the recomputed `price`; when it is not, a `payment` object in the body is pinned to the stored price rather than the client's cached amount. Do not restore the unconditional recompute to "keep things in sync" — that is the bug.

`PUT` also validates `rentalDate`/`returnDate` and their ordering and span, which `POST` always did and it did not. An inverted range made `eachDayInRange` return `[]`, so `isMachineAvailable` skipped both of its loops and reported available regardless of blackouts, and `Math.max(1, negative span)` repriced a multi-day rental as one day — while the stored document could no longer satisfy the overlap query, silently removing its unit from inventory accounting.

Unknown extra/mixer ids are rejected **only when the caller sent them**. `merged` falls back to the stored order, so resolving it against the _current_ catalog used to 400 on an id an admin had since deleted from `Settings` — locking that order out of every edit, cancellation included, while it went on holding its unit.

Model validators that need `machineType` must read it via `machineTypeInContext(this)` (`src/models/rental.ts`). Under `findByIdAndUpdate(..., { runValidators: true })` Mongoose binds `this` to the Query, not the document, so reading `this.machineType` directly is always `undefined` — that is what made every admin order edit fail validation and return a 500.

Server-side "is this date in the past" checks go through `todayLocalIso()` in `src/lib/dates.ts` (re-exported from `validation.ts`), which resolves the date in `America/Chicago`. Vercel functions run UTC; reading the server clock's local date rejected same-day bookings every evening after 19:00 Central.

`src/lib/dates.ts` is the **zod-free** module both the browser and the server import: `todayLocalIso`, `spanInDays`, and the `EMAIL_PATTERN` / `PHONE_PATTERN` / `ZIP_PATTERN` field regexes. Do not import zod into it — that is what would put every request schema into the order-form bundle. The client's `validateEmail` / `validatePhone` / `validateZipCode` in `components/order/utils.ts` and the zod schemas in `validation.ts` share these constants, so a value cannot clear all five wizard steps and then 400 at checkout. It could: the client's old email regex was looser than zod's `.email()`.

`/api/save-booking` also re-runs `validateDeliveryTime` and `isBexarCountyZipCode` server-side. Both rules were browser-only, so a direct POST could book a 03:00 delivery to any ZIP in the country.

### Public API Hardening

All four public write routes (`/api/save-booking`, `/api/v1/contacts`, `/api/v1/lease-inquiries`, `/api/v1/analytics/fingerprint`) go through `guardPublicWrite()` in `src/lib/api-guard.ts`, which applies a per-IP fixed-window rate limit and a body-size cap before parsing JSON. The limiter (`src/lib/rate-limit.ts`) uses Upstash Redis when it is configured and falls back to per-instance memory otherwise. It accepts **either** `UPSTASH_REDIS_REST_URL`/`_TOKEN` (Upstash's own names, for a hand-configured deployment) **or** `KV_REST_API_URL`/`_TOKEN` (what the Vercel Marketplace integration injects). Reading only the first meant the integration could be provisioned, connected and billed while every request silently used the memory limiter — invisible, because the fallback works. Do not duplicate the values under both names; rotating the resource's token in Vercel should flow through without a second edit. Each route then parses through a zod schema and builds its Mongo document from an explicit field list — never `Model.create(body)`.

Customer-supplied strings interpolated into notification email must go through `escapeHtml()` from `src/lib/validation.ts`.

### Notifications

Triggered after a booking, contact submission, or lease inquiry: SMS via Twilio (`TWILIO_*` env vars) and email via Resend (`RESEND_API_KEY`). Escape every customer-supplied value with `escapeHtml()` before interpolating it into an email body.

### Admin Settings Override

The `Settings` model (`src/models/settings.ts`) stores **one singleton document keyed `{ key: "global" }`** — always query it with that filter. It holds runtime overrides for:

- `fees` — `deliveryFee`, `salesTaxRate`, `processingFeeRate`, `serviceDiscountRate`
- `machines.{single,double,triple}` — `basePrice` **and** `inventory` (drives availability, see above)
- `mixers` / `extras` / `leaseTiers` — `Schema.Types.Mixed` maps with schema-level defaults
- `operations` — `deliveryWindowStartHour` / `EndHour`, guarded by a `pre("validate")` hook requiring end > start
- `documentation` — lease PDF URL/label

`GET /api/v1/settings` is public and returns only these whitelisted fields; if no document exists it instantiates a non-persisted `new Settings({})` so callers always get the schema defaults. Both the route and any server component read it through `getPublicSettings()` (`src/lib/public-settings.ts`) — a server component must call that directly rather than HTTP-fetching the app's own route. **A page that calls it must also export `revalidate` (or `dynamic`)**, or Next prerenders it and freezes the settings into the build — `/long-term-lease` shipped that way, so lease-tier edits stayed invisible until the next deploy. `/long-term-lease`, `/pricing`, `/order` and `/service-area/[city]` are all `revalidate = 60` now, and all four read through `getPublicSettingsSafe()` so an unreachable database during prerender degrades to the `rental-data` defaults instead of failing the build. Admin edits go through `/admin/settings` → `PUT /api/admin/settings`, which parses the body with `settingsUpdateSchema` (`src/lib/validation.ts`) and then writes an explicit field whitelist rather than spreading the body.

**The zod schema is not belt-and-braces — it is the only validation on this path.** The write is a `findOneAndUpdate`, and `runValidators` runs _path_ validators only, so the model's `pre("validate")` hook enforcing `deliveryWindowEndHour > deliveryWindowStartHour` never fires here. `src/models/__tests__/settings.test.ts` exercises that hook through `doc.validate()`, which does run it — so the rule was green in CI and absent in production, and an admin could persist an inverted window that made the order form reject every delivery time. The Mixed maps are unvalidated by Mongoose for the same reason; a string where a `price` belongs produced a `NaN` order total. A body that moves only one end of the window is re-checked in the route against the stored document, which the schema cannot see on its own. The order form consumes this through the `SettingsOverrides` type in `src/components/order/utils.ts`.

Because mixers, extras, and lease tiers are `Mixed`, Mongoose does not deep-validate or dirty-track them — reassign the whole object (or `markModified`) when updating.

### Analytics

There are **two independent analytics pipelines**, and they do not share data.

**First-party (MongoDB).** `FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` posts the same payload per order step, plus a `formContext` and a virtual `/order/${step}` path. `GET /api/admin/analytics` aggregates visitor and funnel data for `/admin/analytics` (Chart.js via `react-chartjs-2`). This pipeline is unaffected by ad blockers and consent.

Both trackers check `getConsent()` and do nothing when the visitor has opted out. The banner says "You can opt out at any time"; before that check it only downgraded Google Consent Mode while the first-party fingerprint kept posting on every page view.

**GA4 (gtag).** `GoogleAnalytics.tsx` loads gtag with `NEXT_PUBLIC_GA_MEASUREMENT_ID` and is the **only** path by which GA4 gets data: the GTM container in `NEXT_PUBLIC_GTM_ID` carries just the Google Ads conversion tags (`AW-16908257875`), no GA4 tag, so the two do not double-count. Both components render in production builds only, and `AnalyticsGate.tsx` additionally keeps them off `/admin/*`.

Every GA4 event goes through `trackEvent()` in `src/lib/analytics.ts` — one typed name union, and an optional `window.gtag?.` call so a missing tag (dev, ad blocker, pre-load) is a no-op rather than a throw. Do not call `gtag` directly.

| Event                             | Emitted from                                          | Notes                                                                                                  |
| --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `purchase`                        | `ReviewStep.tsx`, after `/api/save-booking` returns   | `transaction_id` = `bookingId`, `value` = server-side `finalTotal`; items from `buildAnalyticsItems()` |
| `order_step`                      | `OrderFormTracker.tsx`                                | The wizard never changes the URL, so this is the only GA4 funnel signal                                |
| `begin_checkout`                  | `OrderFormTracker.tsx`, on reaching `review`          | `value` from `computeOrderTotal`, plus the same `items` array `purchase` sends                         |
| `view_item_list`                  | `MachineStep.tsx`, `ViewItemListTracker` (`/pricing`) | `item_list_name` is `machine_types` or `pricing_page`. One impression per mount, latched by a ref      |
| `select_item`                     | `MachineStep.tsx`, on choosing a machine              |                                                                                                        |
| `add_to_cart`, `remove_from_cart` | `ExtrasStep.tsx`, on toggling an extra                | Priced from the catalog entry the card was built from                                                  |
| `generate_lead`                   | `ContactForm.tsx`, `LeaseInquiryForm.tsx`             | Both submit inline with no navigation                                                                  |
| `contact_click`, `file_download`  | `ContactLinkTracker.tsx`                              | One delegated `click`+`auxclick` listener matching `tel:` / `mailto:` / `.pdf` / `data-track-download` |

`purchase` and `begin_checkout` must build their `items` from **`buildAnalyticsItems()`** in `utils.ts`. They used to build it separately, which is how the two came to disagree about what was in the cart.

Event params carry segmentation only (`step_id`, `step_index`, `lead_type`, `machine_type`) — **never contact details**. Those four are registered as event-scoped custom dimensions in the GA4 property; an unregistered param is dropped from reporting, and registration is not retroactive.

**`order_step` must not be a key event.** It fires up to five times per visitor and once more on every backwards step. While it is marked as one, 31 of the property's 35 key events over 90 days are wizard steps — the `conversions` metric measures nothing, and importing it into Ads teaches Smart Bidding to optimise for step two of a form. `purchase`, `generate_lead` and `contact_click` are the intended key events.

**Which events are key is GA4 property configuration, not code — nothing in this repo enforces it.** As of 2026-08-12 the live property had it exactly inverted: `order_step` was still marked (31 of 31 events in the trailing fortnight counted as key events) and `contact_click` was not marked at all (3 events, 0 key events). Do not read this section as a description of the property. Verify it, and never from the GA4 UI's own event list — query the `keyEvents` metric by `eventName` through the Analytics MCP:

```
run_report(480725072, date_ranges=[{start_date:"28daysAgo", end_date:"today"}],
           dimensions=["eventName"], metrics=["eventCount","keyEvents"])
```

Marking and unmarking are not retroactive, so historical rows keep whatever flag they were collected under.

### GTM dataLayer events

`pushDataLayer()` in `analytics.ts` is the only sanctioned path to `window.dataLayer`, and there are exactly three events. Both exist because the Google Ads conversion tags in `GTM-NRQ9HDL9` need to fire on a **confirmed outcome carrying real values**, which is not what they used to fire on:

- **`purchase_complete`** (`ReviewStep.tsx`) — carries `transaction_id`, `value`, `currency`. The Ads conversion previously fired on a `/success` pageview, which cannot see the order total, so every booking reported as a valueless conversion; `buildSuccessUrl` deliberately keeps money and PII out of the URL, so the value has to arrive out of band. `transaction_id` is the Ads `orderId` and is what dedupes a resubmission.
- **`lead_submitted`** (`ContactForm.tsx`, `LeaseInquiryForm.tsx`) — carries `lead_type`. Replaces GTM's built-in Form Submission trigger, which listens for the browser's submit event and is **not** suppressed by `preventDefault()`, so a submission whose API POST then failed still counted as an Ads lead.
- **`contact_click`** (`ContactLinkTracker.tsx`) — carries `method` (`phone` or `email`). The Google Ads call tag does dynamic number insertion, which only ever converts visitors who arrived from an ad; roughly 77% of sessions are organic (272 of 351 over the 90 days to 2026-08-11), so a `tel:` tap from them reached Ads not at all. The GTM consumer is the **`Contact Click - phone`** trigger (id `19`, workspace `9`), whose `{{DLV - method}} equals phone` condition lives in the _trigger_, not in the tag. Note that the push shipped in `e0aa248` on 2026-08-12 with no GTM counterpart at all, so for a time it fed nothing — a dataLayer push is only half of a conversion. Downloads deliberately do **not** push — the GTM filter must not be the only thing between a PDF click and a counted phone lead. The name is intentionally both an `AnalyticsEvent` and a `DataLayerEvent`: one visitor action, two transports.

A partial `jest.mock("@/lib/analytics", ...)` that stubs `trackEvent` but not `pushDataLayer` makes the missing export `undefined`, and calling it throws inside the booking submit handler's `try` — which the `catch` turns into "Failed to confirm booking" for the customer. Mock both.

**Never put customer data in a URL.** GA4 records the whole query string as `page_location`. The success redirect is built by `buildSuccessUrl()` in `src/components/order/utils.ts`, which emits only the three params `/success` reads; it previously appended `customerName`, which shipped PII to Google and made every booking its own page path.

Consent Mode v2 defaults to `granted` (inlined in `GoogleAnalytics.tsx` ahead of `config`), with `CookieConsent.tsx` offering an opt-out stored under `satx-ritas-consent`. The GTM tags carried `consentStatus: notSet` until 2026-08-12, meaning the Ads tags fired straight through an opt-out the banner had promised to honour; they now require `ad_storage`, `ad_user_data` and `ad_personalization`. Keep any new Ads tag consent-gated the same way — `notSet` is the GTM default, so this is a thing you have to remember to do, not a thing that happens. Texas TDPSA is an opt-out regime; serving EU traffic would mean flipping those defaults to `denied`.

### Reviews

`getReviewSummary()` in `src/lib/reviews.ts` fetches `https://satxbounce.com/api/v1/reviews` with `next: { revalidate: 3600 }` and never throws — a feed outage returns an empty summary rather than taking the homepage down. `SocialProofSection` is a **server** component reading it directly, so the review text is in the HTML Google indexes and the homepage `LocalBusiness` node can carry `aggregateRating`; fetching it from a client effect meant neither. `GET /api/v1/reviews` is the same helper behind a public route, kept so the browser never calls the external host directly (the CSP `connect-src` would block it).

### Security Headers & CSP

`next.config.ts` attaches HSTS, `X-Frame-Options`, `Permissions-Policy`, and a hand-written **Content-Security-Policy** to every route. The allowlists cover Google Analytics/GTM, `doubleclick.net`/`googleadservices.com` (Google Ads conversions and GA4 Google Signals) and `google.com` frames only — **adding any new third-party script, iframe, font, or fetch target requires editing that CSP string**, or it will silently fail in the browser.

Two rules, both learned from outages and both pinned by `__tests__/security-headers.test.ts`:

1. **List the bare host alongside the wildcard.** A `*.example.com` source matches subdomains only, never the registrable domain itself. `connect-src` listed `https://*.analytics.google.com` but not `analytics.google.com`, which is where gtag actually beacons `/g/collect`, so every hit was refused and the property reported "data collection isn't active" with nothing failing server-side. gtag resolves that host from configuration Google serves at runtime, so collection died on 2026-07-14 under a frozen build, with no deploy on either side of the cliff.
2. **Keep the Google origins symmetric across `script-src`, `img-src` and `connect-src`.** Google moves an endpoint between request types without warning — `googleads.g.doubleclick.net/pagead/viewthroughconversion` is fetched as a pixel and, with `fmt=4`, as a script. A host present in three directives and missing from the fourth is the shape of every outage so far, so the test suite requires all four.

Violations now report to `/api/v1/csp-report` via both `report-uri` and `Reporting-Endpoints`; before that a refused request was invisible in production, which is how both collection outages above ran unnoticed. `script-src` still needs `'unsafe-inline'` for the GTM/GA bootstrap and JSON-LD blocks; moving those to a nonce is the outstanding hardening step. `compiler.removeConsole` strips `console.*` in production builds. Longer write-ups live in `docs/security.md` and `docs/auth-implementation.md`.

### Types

Global shared types live in `src/types/index.ts` (`MachineType`, `MixerType`, `PaymentStatus`, `RentalStatus`, `MargaritaRental`). Machine-specific types and runtime type guards (`isMachineType`, `isMixerType`) are in `src/types/machine.ts`. Admin-only types are in `src/types/admin.ts`.

### Key Library Exports

- `src/lib/rental-data.ts` — `machinePackages` and `mixerDetails` constants (source of base prices and machine metadata)
- `src/lib/pricing.ts` — `calculatePrice()` (core per-day price logic), `formatPrice()` (currency display), `publicPriceTable()` (effective public prices with `Settings` applied) and `offerPriceValidUntil()`
- `src/lib/inventory.ts` — `isMachineAvailable()`, `getMachineInventory()`, `releaseStaleHolds()` (all availability decisions)
- `src/lib/lease-data.ts` — `leaseTiers`, `mergeLeaseTiers()`, lease form enums
- `src/lib/extras-catalog.ts` — `buildExtrasCatalog()`, `resolveSelectedExtras()` (authoritative add-on pricing)
- `src/lib/validation.ts` — zod request schemas, `MACHINE_CAPACITY`, `escapeHtml()`
- `src/lib/dates.ts` — `todayLocalIso()`, `spanInDays()`, the shared field regexes. **Zod-free on purpose**
- `src/lib/admin-list.ts` — `adminListLimit()`, `adminListHeaders()`: bounds the three admin list routes, which returned whole collections with no index behind the sort. The cap is reported in `X-Total-Count` / `X-Result-Truncated` rather than silently dropping rows
- `src/lib/with-timeout.ts` — bounds Twilio and Resend calls, which are awaited inline after the booking is committed
- `src/lib/api-guard.ts` / `src/lib/rate-limit.ts` — `guardPublicWrite()` for public write routes, `guardAdminWrite()` for the body cap on authenticated admin writes. `identifierFromHeaders()` is the single definition of client identity: prefer `x-vercel-forwarded-for` (platform-set), fall back to `x-forwarded-for` only for local/self-hosted. **Never key a limiter on the leftmost `x-forwarded-for` entry** — a proxy appends rather than overwrites, so that value is client-written, and using it dissolved both the public-write caps and the admin login throttle
- `src/lib/safe-error.ts` — `safeErrorSummary()`. Log this, never `error.message`/`error.stack`: Mongoose validation and duplicate-key messages embed the offending customer values, and `removeConsole` deliberately keeps `console.error` in production
- `src/lib/public-settings.ts` — `getPublicSettings()`, and `getPublicSettingsSafe()` for any **prerendered** page. CI builds against an unreachable `MONGODB_URI`, so an uncaught settings read during prerender is a red build the other four gates report green
- `src/lib/landing.ts` — section types, path helpers, `isReservedPath()`, `resolveSections()`, `defaultSection()`. **Zod-free and mongoose-free on purpose**
- `src/lib/landing-page-data.ts` — the landing-page read side, all `…Safe`
- `src/lib/service-area-page.ts` — `serviceAreaPageDoc()` / `serviceAreaFallbackPage()`: one function behind both the seed and the outage fallback
- `src/lib/landing-jsonld.ts` — `buildServiceJsonLd()`, `buildWebPageJsonLd()`, `buildFaqJsonLd()`
- `src/lib/analytics.ts` — `trackEvent()`, the only sanctioned path to `window.gtag`
- `src/lib/site.ts` — `SITE_URL`, `BUSINESS_ID`, the business phone constants, and `breadcrumbJsonLd()`
- `src/hooks/useModalFocus.ts` — focus entry, Tab containment, Escape and focus restore for anything carrying `aria-modal="true"`. Its visibility filter reads attributes rather than layout on purpose: `offsetParent`/`getClientRects` are always empty under jsdom, so a layout-based check matches nothing there and the hook looks inert in its own tests while working in a browser
- `src/lib/consent.ts` — `getConsent()`, `setConsent()` (Consent Mode v2 state)

## Date Handling

Date strings throughout the codebase are in `YYYY-MM-DD` format. Always parse them as **local midnight** by appending `T00:00:00` (e.g. `new Date(dateStr + "T00:00:00")`). Omitting the suffix causes the date to be parsed as UTC midnight, which shifts the date by the user's UTC offset.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
ADMIN_USERNAME, ADMIN_PASSWORD_HASH   (no plaintext fallback)
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
RESEND_API_KEY
NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA_MEASUREMENT_ID   (production only; unset means no GA4 data)
CRON_SECRET
KV_REST_API_URL, KV_REST_API_TOKEN                 (shared rate-limit store; set by the
                                                    Upstash Marketplace integration. Falls back
                                                    to per-instance memory when absent. The
                                                    UPSTASH_REDIS_REST_* names also work.)
NEXT_PUBLIC_GOOGLE_REVIEW_URL   (optional; unset hides the review CTA on /success)
```

See `.env.sample` for the full list.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
