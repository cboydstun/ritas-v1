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

`.github/workflows/ci.yml` runs `typecheck`, `lint`, `format:check` and `test:ci` on every push and PR to `main`. `test:ci` deliberately does **not** pass `--passWithNoTests`, and `jest.config.js` carries `coverageThreshold`s seeded at the coverage when they were added — raise them, do not lower them to get a build out.

Two jest footguns in this repo: importing `jest` from `@jest/globals` defeats SWC's `jest.mock` hoisting, so a `jest.mock("next/navigation", ...)` in such a file silently does nothing — use the global `jest`. And `nanoid` is ESM-only, so `transformIgnorePatterns` must keep transforming it.

Tests are co-located in `__tests__/` folders next to the code they cover. Jest is configured via `next/jest` with `jest-environment-jsdom`. The path alias `@/*` resolves to `src/*` (set in both `tsconfig.json` and `jest.config.js`). Test scripts pass `--passWithNoTests`, so a filter that matches nothing exits 0 — check the reported test count, don't trust a green exit alone.

`npm run typecheck` (`tsc --noEmit`) is the fast type gate. `next.config.ts` sets `typescript.ignoreBuildErrors: false`, so `npm run build` type-checks too — do not flip it back to `true` to get a build out; fix the type.

`npm run lint` calls `eslint .` directly (`next lint` is removed in Next 16). `eslint.config.mjs` must keep its `ignores` entry for `.next/` — without it ESLint walks the build output and reports thousands of bogus errors in minified chunks.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · MongoDB/Mongoose · NextAuth.js v4 · Zod · Tailwind CSS 3

## Architecture

### Routing & Pages

`src/app/` uses the Next.js App Router. Public pages live at the root (`/order`, `/pricing`, `/long-term-lease`, etc.), plus statically generated `/service-area/[city]` pages driven by `SERVICE_AREAS` in `src/lib/service-areas.ts` — the same list `MapSection` and `sitemap.ts` render from, so adding an area there gives it a page, a homepage link and a sitemap entry. Admin pages are under `src/app/admin/` and are protected by the proxy (`src/proxy.ts` — Next 16's rename of the middleware file convention). API routes are split between `src/app/api/v1/` (public) and `src/app/api/admin/` (auth-required). `/api/save-booking` (the public checkout) and `/api/cron/release-holds` sit outside both namespaces at `src/app/api/`.

Two customer-facing verticals share this codebase: **event rentals** (the `/order` wizard, `Rental` model) and **long-term commercial leases** (`/long-term-lease`, an inquiry form only — no payment, `LeaseInquiry` model).

### Multi-Step Order Form

The order flow (`/order`) is a single client component `src/components/order/OrderForm.tsx` that manages a 5-step wizard: date → machine → details → extras → review. Each step is lazy-loaded via `next/dynamic`. Form state is persisted to `localStorage` under key `satx-ritas-order-draft` so drafts survive page reloads. On mount, the form fetches `/api/v1/settings` to get dynamic overrides (mixer options, delivery window hours, pricing). The `StepProps` interface in `src/components/order/types.ts` is the contract between the parent form and each step component.

### Pricing

The single source of truth for all order totals is `computeOrderTotal()` in `src/components/order/utils.ts`. It wraps `calculatePrice()` from `src/lib/pricing.ts` and adds multi-day, extras, and discount logic:

- `perDayRate = basePrice + mixerPrice`
- `rentalDays = calculateRentalDays(rentalDate, returnDate)` — diffs **UTC** calendar dates, minimum 1. Do not reintroduce a millisecond diff of local-midnight `Date`s: a DST fall-back day is 25 hours, which billed one night as two.
- `subtotal = perDayRate × rentalDays + deliveryFee + extrasTotal` (machine rate is per-day; delivery is flat; each extra is per-day unless its catalog entry says `pricingType: "flat"`)
- `serviceDiscountAmount = subtotal × discountRate` — **retired**. No UI sets it and no server route accepts it from a request body; the field survives only for legacy bookings.
- `discountedSubtotal = subtotal − serviceDiscountAmount`

- `processingFee = discountedSubtotal × processingFeeRate`
- `salesTax = (discountedSubtotal + processingFee) × salesTaxRate` — the processing fee is a taxable line item, matching the QuickBooks invoice
- `finalTotal = discountedSubtotal + processingFee + salesTax`

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

**Only `pending` expires.** `releaseStaleHolds()` cancels `pending` holds older than `STALE_HOLD_MINUTES` (120); it runs from the `/api/cron/release-holds` Vercel cron (see `vercel.json`, guarded by `CRON_SECRET`) and again at the top of `/api/save-booking` as a safety net. `pending_payment` is the status a _submitted_ booking carries — the customer has a confirmation email and is invoiced out of band — and nothing promotes it to `confirmed` except a manual admin edit. Reaping it cancelled every real booking two hours after it was placed and put the machine back on sale. Do not add it back to either the reaper or the query-time cutoff.

`MachineStep.tsx` checks all three machine types **in parallel** on mount so every card shows live availability, greys out unavailable ones, and auto-switches the selection to another available type (priority `triple > double > single`) when the current pick is unavailable. `useAvailabilityCheck` (`src/hooks/useAvailabilityCheck.ts`) wraps the single-type fetch.

Admins manage blackout date ranges via `/admin/blackout-dates` → `GET/POST /api/admin/blackout-dates` and `DELETE /api/admin/blackout-dates/[id]`.

### Long-Term Lease Flow

`/long-term-lease` renders three tiers (`single-15`, `double-30`, `triple-45`) via `LeaseTierCard.tsx`. Baseline tier data lives in `src/lib/lease-data.ts` (`leaseTiers`); `mergeLeaseTiers(overrides)` shallow-merges the admin `Settings.leaseTiers` overrides on top, so pricing/specs are editable at runtime without a deploy. `LeaseInquiryForm.tsx` posts to `POST /api/v1/lease-inquiries` (stored in the `LeaseInquiry` model, `src/models/leaseInquiry.ts`); admins triage them at `/admin/lease-inquiries` → `GET /api/admin/lease-inquiries`, `PATCH/DELETE /api/admin/lease-inquiries/[id]`. `LEASE_BUSINESS_TYPES` and `LEASE_TERMS` in `lease-data.ts` are the form's dropdown sources.

### Database

MongoDB via Mongoose. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`, `leaseInquiry.ts`. Every model uses the `mongoose.models.X || mongoose.model(...)` guard — keep that pattern or hot reload throws `OverwriteModelError`.

### Authentication (Admin)

NextAuth.js credentials provider with JWT session strategy (no database sessions). Config is in `src/lib/auth.ts`.

`package.json` carries an `overrides` entry pinning `nodemailer` to `^9.0.5`. next-auth v4 depends on a vulnerable range (six advisories, one high) purely for its email provider, which this app does not use — only `CredentialsProvider` is configured. **If an email provider is ever added, drop the override and check next-auth against nodemailer 9 first.** next-auth v5 is still beta and is not a fix for this.
The username comes from `ADMIN_USERNAME`; the password is checked against the bcrypt hash in `ADMIN_PASSWORD_HASH`, falling back (with a warning) to plaintext `ADMIN_PASSWORD` if the hash is unset. Both comparisons are constant-time and the credentials callback is IP rate-limited. Auth is enforced in two layers: `src/proxy.ts` uses `getToken()` to reject unauthenticated requests early — it requires both a token and `token.role === "admin"` (page requests redirect to `/admin/login`, API requests return 401) — and individual admin route handlers redundantly call `getServerSession(authOptions)` as defense-in-depth. The proxy also force-redirects HTTP→HTTPS in production via `x-forwarded-proto`, using the host from `SITE_URL` rather than the `Host` header (trusting the header made it an open redirect). Its matcher is scoped to `/admin/*` and `/api/admin/*` — widen it if `PERMANENT_REDIRECTS` ever gains a public-page entry.

### Checkout Flow

There is **no online payment**. `ReviewStep.tsx` posts to `POST /api/save-booking`, which is the public customer checkout endpoint (unauthenticated by design). It generates a `bookingId` via nanoid, persists a `Rental` with status `pending_payment`, and sends confirmation via Resend email + Twilio SMS. The customer is invoiced afterwards out-of-band.

The PayPal integration was removed — the component had no importers and its routes charged nobody. Only `Rental.paypalOrderId` and the `pending` status value remain, for historical documents.

`/api/save-booking` never trusts the request body for money:

- The body is parsed by `rentalDataSchema` (`src/lib/validation.ts`); unknown fields are stripped.
- `capacity` is **derived** from `machineType`, never read from the request.
- `selectedExtras` is re-resolved through `resolveSelectedExtras()` (`src/lib/extras-catalog.ts`); only `id` and `quantity` are honoured, prices come from the catalog, and unknown ids are a 400.
- `price` and `payment.amount` are both set from the server-side `computeOrderTotal`.
- `isServiceDiscount` is hard-coded `false`.

The admin order routes (`POST /api/admin/orders`, `PUT /api/admin/orders/[id]`) enforce the same invariants: an explicit field whitelist, `capacity` derived from `machineType`, extras re-resolved through the catalog, and `price` recomputed by `computeOrderTotal`. Both re-check `isMachineAvailable` before writing: `POST` on create, and `PUT` (with `excludeRentalId`) whenever an edit moves the machine type or the dates **or revives a cancelled order** — `PUT { status: "confirmed" }` on a cancelled booking put a unit back onto a date that may have filled up in the meantime. Neither route accepts `capacity` or `price` from the body.

Model validators that need `machineType` must read it via `machineTypeInContext(this)` (`src/models/rental.ts`). Under `findByIdAndUpdate(..., { runValidators: true })` Mongoose binds `this` to the Query, not the document, so reading `this.machineType` directly is always `undefined` — that is what made every admin order edit fail validation and return a 500.

Server-side "is this date in the past" checks go through `todayLocalIso()` in `src/lib/validation.ts`, which resolves the date in `America/Chicago`. Vercel functions run UTC; reading the server clock's local date rejected same-day bookings every evening after 19:00 Central.

### Public API Hardening

All four public write routes (`/api/save-booking`, `/api/v1/contacts`, `/api/v1/lease-inquiries`, `/api/v1/analytics/fingerprint`) go through `guardPublicWrite()` in `src/lib/api-guard.ts`, which applies a per-IP fixed-window rate limit and a body-size cap before parsing JSON. The limiter (`src/lib/rate-limit.ts`) uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set and falls back to per-instance memory otherwise. Each route then parses through a zod schema and builds its Mongo document from an explicit field list — never `Model.create(body)`.

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

`GET /api/v1/settings` is public and returns only these whitelisted fields; if no document exists it instantiates a non-persisted `new Settings({})` so callers always get the schema defaults. Both the route and any server component read it through `getPublicSettings()` (`src/lib/public-settings.ts`) — a server component must call that directly rather than HTTP-fetching the app's own route. Admin edits go through `/admin/settings` → `PUT /api/admin/settings`, which writes an explicit field whitelist rather than spreading the body. The order form consumes this through the `SettingsOverrides` type in `src/components/order/utils.ts`.

Because mixers, extras, and lease tiers are `Mixed`, Mongoose does not deep-validate or dirty-track them — reassign the whole object (or `markModified`) when updating.

### Analytics

There are **two independent analytics pipelines**, and they do not share data.

**First-party (MongoDB).** `FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` posts the same payload per order step, plus a `formContext` and a virtual `/order/${step}` path. `GET /api/admin/analytics` aggregates visitor and funnel data for `/admin/analytics` (Chart.js via `react-chartjs-2`). This pipeline is unaffected by ad blockers and consent.

**GA4 (gtag).** `GoogleAnalytics.tsx` loads gtag with `NEXT_PUBLIC_GA_MEASUREMENT_ID` and is the **only** path by which GA4 gets data: the GTM container in `NEXT_PUBLIC_GTM_ID` carries just the Google Ads conversion tags (`AW-16908257875`), no GA4 tag, so the two do not double-count. Both components render in production builds only, and `AnalyticsGate.tsx` additionally keeps them off `/admin/*`.

Every GA4 event goes through `trackEvent()` in `src/lib/analytics.ts` — one typed name union, and an optional `window.gtag?.` call so a missing tag (dev, ad blocker, pre-load) is a no-op rather than a throw. Do not call `gtag` directly.

| Event                            | Emitted from                                        | Notes                                                                                                                                       |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `purchase`                       | `ReviewStep.tsx`, after `/api/save-booking` returns | `transaction_id` = `bookingId`, `value` = server-side `finalTotal`; items priced from `buildExtrasCatalog()`, never from the submitted item |
| `order_step`                     | `OrderFormTracker.tsx`                              | The wizard never changes the URL, so this is the only GA4 funnel signal                                                                     |
| `begin_checkout`                 | `OrderFormTracker.tsx`, on reaching `review`        |                                                                                                                                             |
| `generate_lead`                  | `ContactForm.tsx`, `LeaseInquiryForm.tsx`           | Both submit inline with no navigation                                                                                                       |
| `contact_click`, `file_download` | `ContactLinkTracker.tsx`                            | One delegated listener matching `tel:` / `mailto:` / `.pdf` hrefs                                                                           |

Event params carry segmentation only (`step_id`, `step_index`, `lead_type`, `machine_type`) — **never contact details**. Those four are registered as event-scoped custom dimensions in the GA4 property; an unregistered param is dropped from reporting, and registration is not retroactive. `order_step`, `generate_lead` and `purchase` are marked as key events.

**Never put customer data in a URL.** GA4 records the whole query string as `page_location`. The success redirect is built by `buildSuccessUrl()` in `src/components/order/utils.ts`, which emits only the three params `/success` reads; it previously appended `customerName`, which shipped PII to Google and made every booking its own page path.

Consent Mode v2 defaults to `granted` (inlined in `GoogleAnalytics.tsx` ahead of `config`), with `CookieConsent.tsx` offering an opt-out stored under `satx-ritas-consent`. Texas TDPSA is an opt-out regime; serving EU traffic would mean flipping those defaults to `denied`.

### Reviews

`getReviewSummary()` in `src/lib/reviews.ts` fetches `https://satxbounce.com/api/v1/reviews` with `next: { revalidate: 3600 }` and never throws — a feed outage returns an empty summary rather than taking the homepage down. `SocialProofSection` is a **server** component reading it directly, so the review text is in the HTML Google indexes and the homepage `LocalBusiness` node can carry `aggregateRating`; fetching it from a client effect meant neither. `GET /api/v1/reviews` is the same helper behind a public route, kept so the browser never calls the external host directly (the CSP `connect-src` would block it).

### Security Headers & CSP

`next.config.ts` attaches HSTS, `X-Frame-Options`, `Permissions-Policy`, and a hand-written **Content-Security-Policy** to every route. The allowlists cover Google Analytics/GTM, `doubleclick.net`/`googleadservices.com` (Google Ads conversions and GA4 Google Signals) and `google.com` frames only — **adding any new third-party script, iframe, font, or fetch target requires editing that CSP string**, or it will silently fail in the browser.

Two rules, both learned from outages and both pinned by `__tests__/security-headers.test.ts`:

1. **List the bare host alongside the wildcard.** A `*.example.com` source matches subdomains only, never the registrable domain itself. `connect-src` listed `https://*.analytics.google.com` but not `analytics.google.com`, which is where gtag actually beacons `/g/collect`, so every hit was refused and the property reported "data collection isn't active" with nothing failing server-side. gtag resolves that host from configuration Google serves at runtime, so collection died on 2026-07-14 under a frozen build, with no deploy on either side of the cliff.
2. **Keep the Google origins symmetric across `script-src`, `img-src` and `connect-src`.** Google moves an endpoint between request types without warning — `googleads.g.doubleclick.net/pagead/viewthroughconversion` is fetched as a pixel and, with `fmt=4`, as a script. A host present in three directives and missing from the fourth is the shape of every outage so far, so the test suite requires all four.

`script-src` still needs `'unsafe-inline'` for the GTM/GA bootstrap and JSON-LD blocks; moving those to a nonce is the outstanding hardening step. `compiler.removeConsole` strips `console.*` in production builds. Longer write-ups live in `docs/security.md` and `docs/auth-implementation.md`.

### Types

Global shared types live in `src/types/index.ts` (`MachineType`, `MixerType`, `PaymentStatus`, `RentalStatus`, `MargaritaRental`). Machine-specific types and runtime type guards (`isMachineType`, `isMixerType`) are in `src/types/machine.ts`. Admin-only types are in `src/types/admin.ts`.

### Key Library Exports

- `src/lib/rental-data.ts` — `machinePackages` and `mixerDetails` constants (source of base prices and machine metadata)
- `src/lib/pricing.ts` — `calculatePrice()` (core per-day price logic) and `formatPrice()` (currency display)
- `src/lib/inventory.ts` — `isMachineAvailable()`, `getMachineInventory()`, `releaseStaleHolds()` (all availability decisions)
- `src/lib/lease-data.ts` — `leaseTiers`, `mergeLeaseTiers()`, lease form enums
- `src/lib/extras-catalog.ts` — `buildExtrasCatalog()`, `resolveSelectedExtras()` (authoritative add-on pricing)
- `src/lib/validation.ts` — zod request schemas, `MACHINE_CAPACITY`, `escapeHtml()`
- `src/lib/api-guard.ts` / `src/lib/rate-limit.ts` — `guardPublicWrite()` for public write routes
- `src/lib/analytics.ts` — `trackEvent()`, the only sanctioned path to `window.gtag`
- `src/lib/consent.ts` — `getConsent()`, `setConsent()` (Consent Mode v2 state)

## Date Handling

Date strings throughout the codebase are in `YYYY-MM-DD` format. Always parse them as **local midnight** by appending `T00:00:00` (e.g. `new Date(dateStr + "T00:00:00")`). Omitting the suffix causes the date to be parsed as UTC midnight, which shifts the date by the user's UTC offset.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
ADMIN_USERNAME, ADMIN_PASSWORD_HASH   (legacy fallback: ADMIN_PASSWORD)
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
RESEND_API_KEY
NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA_MEASUREMENT_ID   (production only; unset means no GA4 data)
CRON_SECRET
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN   (optional; shared rate-limit store)
NEXT_PUBLIC_GOOGLE_REVIEW_URL   (optional; unset hides the review CTA on /success)
```

See `.env.sample` for the full list.
