# Security Implementation Guide

This document outlines the security measures implemented in the SATX Ritas application, focusing on HTTPS enforcement and security headers.

## HTTPS Enforcement

HTTPS is enforced for all traffic in production through three layers:

1. **Vercel's edge** forces HTTPS before a request reaches the application at
   all. This is the layer that actually does the work.

2. **`src/proxy.ts`** (Next 16's rename of the middleware file convention)
   redirects any remaining HTTP request. See `src/proxy.ts` for the current
   code — the important detail is that the redirect target host comes from
   `SITE_URL` via `allowedHost()`, **never from the `Host` header**.

   Trusting the header made this a cacheable open redirect: `Host: evil.com`
   plus `x-forwarded-proto: http` returned a 301 to `https://evil.com/<path>`.
   Do not reintroduce `request.headers.get("host")` here.

   Note that the proxy's matcher is scoped to `/admin/*` and `/api/admin/*`, so
   this redirect no longer runs for public traffic — layers 1 and 3 cover it.

3. **`upgrade-insecure-requests`** in the Content-Security-Policy, which
   instructs browsers to upgrade HTTP subresource requests to HTTPS.

## Security Headers

The application implements the following security headers for all routes:

### HTTP Strict Transport Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- Enforces HTTPS for 2 years (63072000 seconds)
- Applies to all subdomains
- Indicates the site should be included in browser preload lists

### Content Security Policy (CSP)

The policy is hand-written in `next.config.ts` and applies to every route. Treat
that file as the source of truth; the summary below is the intent behind it.

Directives, and what each one exists for:

- `default-src 'self'` — everything not listed below is same-origin only.
- `script-src` — same origin, `'unsafe-inline'`, and the Google analytics/ads
  origins. `'unsafe-inline'` is still required by the gtag/GTM bootstrap and the
  JSON-LD blocks; moving those to a nonce is the outstanding hardening step.
  `'unsafe-eval'` is **not** granted.
- `style-src` — same origin plus inline styles.
- `img-src` — same origin, `data:` URIs, and the same Google origins (the Ads
  remarketing pixel is an image).
- `font-src 'self'` — fonts are self-hosted via `next/font`.
- `connect-src` — where gtag and the Ads tags beacon.
- `frame-src` — the GTM noscript iframe, the DoubleClick conversion linker, and
  the Ads call-tracking frames.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'self'`, `upgrade-insecure-requests`.

**Adding any third-party script, iframe, font, or fetch target means editing
this policy**, or it fails silently in the browser with nothing visible
server-side.

Two rules learned the hard way, both encoded as assertions in
`__tests__/security-headers.test.ts`:

1. A `*.example.com` wildcard matches subdomains **only**, never the bare
   registrable domain. `https://*.analytics.google.com` does not permit
   `analytics.google.com`. List both forms for every analytics origin.
2. Keep the Google origins symmetric across `script-src`, `img-src` and
   `connect-src`. Google moves an endpoint between request types without
   warning; a host present in three directives and absent from the fourth is
   how collection died for two weeks in July 2026.

### Additional Security Headers

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- `X-Content-Type-Options`: Prevents MIME type sniffing
- `Referrer-Policy`: Controls referrer information
- `X-Frame-Options`: Prevents clickjacking by restricting framing
- `Permissions-Policy`: Restricts access to browser features

`X-XSS-Protection` is deliberately **not** sent. The header is unsupported in
every current browser and its legacy auditor introduced vulnerabilities of its
own; the CSP replaces it.

### Analytics privacy

- Nothing customer-identifying may be placed in a URL. GA4 records the full
  query string as `page_location`, so PII there is both a Google ToS violation
  and a reporting problem (each value becomes its own page path). The
  `/success` redirect carries `bookingId`, `machineType` and `mixers` only.
- GA4 events are emitted exclusively through `trackEvent()` in
  `src/lib/analytics.ts`: `purchase`, `begin_checkout`, `order_step`,
  `generate_lead`, `contact_click`, `file_download`. Event parameters carry
  segmentation (machine type, lead type, step) and never contact details.
- `AnalyticsGate` keeps the tags off `/admin/*`.
- Consent Mode v2 defaults to `granted` and `CookieConsent` offers an opt-out,
  matching the Texas TDPSA opt-out regime. Serving EU traffic would require
  flipping the defaults in `GoogleAnalytics.tsx` to `denied`.

## Implementation Details

These security measures are implemented in:

1. **Proxy** (`src/proxy.ts`): Handles HTTP to HTTPS redirects
2. **Next.js Config** (`next.config.ts`): Configures security headers

## Testing Security Headers

You can verify the security headers using:

1. Browser Developer Tools (Network tab)
2. Online tools like [Security Headers](https://securityheaders.com/)
3. [Mozilla Observatory](https://observatory.mozilla.org/)

## Development Considerations

- Security headers are applied in all environments, but HTTPS redirects only occur in production
- The CSP allows 'unsafe-inline' and 'unsafe-eval' for development convenience, but these should be restricted further in a high-security environment
- Google Analytics, GTM, Google Ads (`doubleclick.net`, `googleadservices.com`)
  and `google.com` frames are explicitly allowed in the CSP. PayPal origins were
  removed with the integration.

## Future Enhancements

Consider implementing:

1. **Subresource Integrity (SRI)** for external scripts
2. **Feature-Policy** for more granular control of browser features
3. **Report-To** and **Report-URI** for CSP violation reporting
4. **Certificate Transparency** monitoring
5. Further restricting the CSP by removing 'unsafe-inline' and 'unsafe-eval' where possible
