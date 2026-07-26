# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier (writes in place)
npm test             # Jest (all tests)
npm run test:watch   # Jest watch mode
npm run test:machine # Run only machine-step tests
npm run test:coverage # Jest with coverage report
npm run test:ci      # Jest in CI mode with coverage
```

Run a single test file: `npx jest src/components/order/steps/__tests__/SomeTest.test.tsx`

Tests are co-located in `__tests__/` folders next to the code they cover. Jest is configured via `next/jest` with `jest-environment-jsdom`. The path alias `@/*` resolves to `src/*` (set in both `tsconfig.json` and `jest.config.js`). Test scripts pass `--passWithNoTests`, so a filter that matches nothing exits 0 — check the reported test count, don't trust a green exit alone.

`next.config.ts` sets `typescript.ignoreBuildErrors: true`, so **`npm run build` does not fail on type errors**. Run `npx tsc --noEmit` to actually typecheck.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript 5 · MongoDB/Mongoose · NextAuth.js v4 · PayPal · Tailwind CSS 3

## Architecture

### Routing & Pages

`src/app/` uses the Next.js App Router. Public pages live at the root (`/order`, `/pricing`, `/long-term-lease`, etc.). Admin pages are under `src/app/admin/` and are protected by middleware. API routes are split between `src/app/api/v1/` (public) and `src/app/api/admin/` (auth-required). The PayPal routes (`/api/create-paypal-order`, `/api/capture-paypal-order`) and `/api/save-booking` sit outside both namespaces at `src/app/api/`.

Two customer-facing verticals share this codebase: **event rentals** (the `/order` wizard, PayPal, `Rental` model) and **long-term commercial leases** (`/long-term-lease`, an inquiry form only — no payment, `LeaseInquiry` model).

### Multi-Step Order Form

The order flow (`/order`) is a single client component `src/components/order/OrderForm.tsx` that manages a 5-step wizard: date → machine → details → extras → review. Each step is lazy-loaded via `next/dynamic`. Form state is persisted to `localStorage` under key `satx-ritas-order-draft` so drafts survive page reloads. On mount, the form fetches `/api/v1/settings` to get dynamic overrides (mixer options, delivery window hours, pricing). The `StepProps` interface in `src/components/order/types.ts` is the contract between the parent form and each step component.

### Pricing

The single source of truth for all order totals is `computeOrderTotal()` in `src/components/order/utils.ts`. It wraps `calculatePrice()` from `src/lib/pricing.ts` and adds multi-day, extras, and discount logic:

- `perDayRate = basePrice + mixerPrice`
- `subtotal = perDayRate × rentalDays + deliveryFee + extrasTotal` (extras and machine rate are per-day; delivery is flat)
- `serviceDiscountAmount = subtotal × discountRate` (default 10%, only if `isServiceDiscount` is set — military/service personnel perk)
- `discountedSubtotal = subtotal − serviceDiscountAmount`
- `processingFee = discountedSubtotal × processingFeeRate`
- `salesTax = discountedSubtotal × salesTaxRate`
- `finalTotal = discountedSubtotal + processingFee + salesTax`

Default constants: delivery $20, sales tax 8.25%, processing 3%, service discount 10%. Base machine prices come from `src/lib/rental-data.ts`. The `PricingOverrides` type in `src/lib/pricing.ts` and `SettingsOverrides` in `utils.ts` allow the admin `Settings` document to override any of these at runtime.

### Availability & Inventory

`isMachineAvailable()` in `src/lib/inventory.ts` is the single source of truth for "can this machine be booked". `GET /api/v1/availability?machineType=&capacity=&date=&returnDate=` is a thin validating wrapper over it (`returnDate` optional, defaults to `date`). The algorithm:

1. Expand `[rentalDate, returnDate]` into every `YYYY-MM-DD` day in range.
2. Reject if any day falls in a `BlackoutDate` range (`isDateBlackedOut`).
3. Look up the per-type unit count via `getMachineInventory()` — reads `Settings.machines[type].inventory`; reject outright if `0`.
4. Count overlapping `Rental` docs **per day** (statuses `pending`, `pending_payment`, `confirmed`, `in-progress`); reject if any single day has `booked >= inventory`.

So a machine type is bookable while units remain, not simply because one rental exists. Note the fallback `DEFAULT_INVENTORY` in `inventory.ts` is `1` per type, whereas the `Settings` schema defaults are `single: 3, double: 3, triple: 2` — the constant only applies when no Settings document or no configured value exists.

`MachineStep.tsx` checks all three machine types **in parallel** on mount so every card shows live availability, greys out unavailable ones, and auto-switches the selection to another available type (priority `triple > double > single`) when the current pick is unavailable. `useAvailabilityCheck` (`src/hooks/useAvailabilityCheck.ts`) wraps the single-type fetch.

Admins manage blackout date ranges via `/admin/blackout-dates` → `GET/POST /api/admin/blackout-dates` and `DELETE /api/admin/blackout-dates/[id]`.

### Long-Term Lease Flow

`/long-term-lease` renders three tiers (`single-15`, `double-30`, `triple-45`) via `LeaseTierCard.tsx`. Baseline tier data lives in `src/lib/lease-data.ts` (`leaseTiers`); `mergeLeaseTiers(overrides)` shallow-merges the admin `Settings.leaseTiers` overrides on top, so pricing/specs are editable at runtime without a deploy. `LeaseInquiryForm.tsx` posts to `POST /api/v1/lease-inquiries` (stored in the `LeaseInquiry` model, `src/models/leaseInquiry.ts`); admins triage them at `/admin/lease-inquiries` → `GET /api/admin/lease-inquiries`, `PATCH/DELETE /api/admin/lease-inquiries/[id]`. `LEASE_BUSINESS_TYPES` and `LEASE_TERMS` in `lease-data.ts` are the form's dropdown sources.

### Database

MongoDB via Mongoose. Connection is cached in `src/lib/mongodb.ts` using a global variable to avoid creating new connections on every serverless invocation. Models live in `src/models/`: `rental.ts`, `thumbprint.ts`, `contact.ts`, `blackout-date.ts`, `settings.ts`, `leaseInquiry.ts`. Every model uses the `mongoose.models.X || mongoose.model(...)` guard — keep that pattern or hot reload throws `OverwriteModelError`.

### Authentication (Admin)

NextAuth.js credentials provider with JWT session strategy (no database sessions). Config is in `src/lib/auth.ts`; admin credentials come from env vars `ADMIN_USERNAME`/`ADMIN_PASSWORD`. Auth is enforced in two layers: `src/middleware.ts` uses `getToken()` to reject unauthenticated requests early — it requires both a token and `token.role === "admin"` (page requests redirect to `/admin/login`, API requests return 401) — and individual admin route handlers redundantly call `getServerSession(authOptions)` as defense-in-depth. The middleware also force-redirects HTTP→HTTPS in production via `x-forwarded-proto`.

### PayPal Flow

1. Client submits the review step → calls `POST /api/create-paypal-order` (server-side SDK creates a PayPal order, returns `orderID`).
2. `PayPalCheckout.tsx` renders the PayPal button with that `orderID`.
3. On buyer approval, client calls `POST /api/capture-paypal-order` which captures payment and saves the `Rental` document to MongoDB. After capture, Twilio SMS and Nodemailer email notifications fire server-side.

There is also `POST /api/save-booking` used for admin-created manual bookings (no PayPal). It generates a `bookingId` via nanoid and sends confirmation via Resend email + Twilio SMS.

### Notifications

Triggered after successful payment capture or manual booking: SMS via Twilio (`TWILIO_*` env vars) and email via Nodemailer (Gmail SMTP) for PayPal orders, or Resend (`RESEND_API_KEY`) for manual bookings and contact form submissions.

### Admin Settings Override

The `Settings` model (`src/models/settings.ts`) stores **one singleton document keyed `{ key: "global" }`** — always query it with that filter. It holds runtime overrides for:

- `fees` — `deliveryFee`, `salesTaxRate`, `processingFeeRate`, `serviceDiscountRate`
- `machines.{single,double,triple}` — `basePrice` **and** `inventory` (drives availability, see above)
- `mixers` / `extras` / `leaseTiers` — `Schema.Types.Mixed` maps with schema-level defaults
- `operations` — `deliveryWindowStartHour` / `EndHour`, guarded by a `pre("validate")` hook requiring end > start
- `documentation` — lease PDF URL/label

`GET /api/v1/settings` is public and returns only these whitelisted fields; if no document exists it instantiates a non-persisted `new Settings({})` so callers always get the schema defaults. Admin edits go through `/admin/settings` → `PATCH /api/admin/settings`. The order form consumes this through the `SettingsOverrides` type in `src/components/order/utils.ts`.

Because mixers, extras, and lease tiers are `Mixed`, Mongoose does not deep-validate or dirty-track them — reassign the whole object (or `markModified`) when updating.

### Analytics

`FingerprintTracker.tsx` uses ThumbmarkJS to generate a browser fingerprint and posts it to `/api/v1/analytics/fingerprint` (stored in `Thumbprint` model). `OrderFormTracker.tsx` fires GA4/GTM events as users progress through order steps. `GET /api/admin/analytics` aggregates visitor and funnel data for `/admin/analytics` (Chart.js via `react-chartjs-2`).

### Reviews

`GET /api/v1/reviews` is a server-side proxy to `https://satxbounce.com/api/v1/reviews` with `next: { revalidate: 3600 }`. It exists so the browser never calls the external host directly (the CSP `connect-src` would block it) and so responses are cached for an hour.

### Security Headers & CSP

`next.config.ts` attaches HSTS, `X-Frame-Options`, `Permissions-Policy`, and a hand-written **Content-Security-Policy** to every route. The allowlists currently cover PayPal, Google Analytics/GTM, and `google.com` frames only — **adding any new third-party script, iframe, font, or fetch target requires editing that CSP string**, or it will silently fail in the browser. `compiler.removeConsole` strips `console.*` in production builds. Longer write-ups live in `docs/security.md` and `docs/auth-implementation.md`.

### Types

Global shared types live in `src/types/index.ts` (`MachineType`, `MixerType`, `PaymentStatus`, `RentalStatus`, `MargaritaRental`). Machine-specific types and runtime type guards (`isMachineType`, `isMixerType`) are in `src/types/machine.ts`. Admin-only types are in `src/types/admin.ts`. PayPal SDK types are augmented in `src/types/paypal.d.ts`.

### Key Library Exports

- `src/lib/rental-data.ts` — `machinePackages` and `mixerDetails` constants (source of base prices and machine metadata)
- `src/lib/pricing.ts` — `calculatePrice()` (core per-day price logic) and `formatPrice()` (currency display)
- `src/lib/inventory.ts` — `isMachineAvailable()` and `getMachineInventory()` (all availability decisions)
- `src/lib/lease-data.ts` — `leaseTiers`, `mergeLeaseTiers()`, lease form enums
- `src/lib/paypal-server.ts` — `initializePayPalSDK()` and `isValidPayPalEnv()` (called once per server boot)

## Date Handling

Date strings throughout the codebase are in `YYYY-MM-DD` format. Always parse them as **local midnight** by appending `T00:00:00` (e.g. `new Date(dateStr + "T00:00:00")`). Omitting the suffix causes the date to be parsed as UTC midnight, which shifts the date by the user's UTC offset.

## Environment Variables

```
MONGODB_URI, MONGODB_DB
NEXT_PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_LIVE_MODE
ADMIN_USERNAME, ADMIN_PASSWORD
NEXTAUTH_SECRET, NEXTAUTH_URL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, USER_PHONE_NUMBER
NODEMAILER_USERNAME, NODEMAILER_PASSWORD
RESEND_API_KEY
NEXT_PUBLIC_GTM_ID
```

See `.env.sample` for the full list.
