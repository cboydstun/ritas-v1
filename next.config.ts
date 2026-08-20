import type { NextConfig } from "next";

export const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // X-XSS-Protection is deliberately omitted: the legacy auditor it enabled
  // is gone from modern browsers and was itself an XSS vector.
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    // 'unsafe-inline' is still required by the GTM/GA bootstrap snippets and
    // the JSON-LD blocks; moving those to a nonce is the remaining hardening
    // step. 'unsafe-eval' is gone — only the (now deleted) PayPal SDK wanted it.
    //
    // The analytics allowlists below must cover where GA4 actually sends
    // beacons (region1./analytics.google.com) and the GTM noscript iframe;
    // omitting them silently dropped measurement rather than failing loudly.
    // That is not hypothetical, and it has bitten twice. A CSP wildcard
    // matches subdomains ONLY, never the bare registrable domain, so
    // https://*.analytics.google.com does not permit analytics.google.com —
    // which is exactly where gtag beacons /g/collect. Google moved that
    // endpoint with no deploy on our side and collection stopped dead.
    // List both the bare host and the wildcard for every analytics origin.
    //
    // doubleclick.net and googleadservices.com are where the Google Ads
    // conversion tags in GTM container GTM-NRQ9HDL9 (AW-16908257875) report,
    // and where GA4's Google Signals does its cookie matching. They fail the
    // same silent way if unlisted. googleads.g.doubleclick.net/pagead/
    // viewthroughconversion is requested BOTH as a pixel and — when the tag
    // appends fmt=4 — as JavaScript injected via a <script> element, so
    // doubleclick belongs in script-src as well as img-src.
    //
    // googlesyndication.com is where a Display, remarketing or Performance Max
    // tag loads from (pagead2.googlesyndication.com, and tpc. for its frames).
    // It was absent from every directive, so the first non-Search campaign
    // would have been refused outright with no error on our side — the exact
    // shape of the two outages above, discovered only by a missing number in a
    // Google report weeks later. Listed before it is needed, not after.
    //
    // googleadservices.com and google.com are listed as wildcard *and* bare
    // host now, not just www.: Ads has already moved conversion.js between
    // www. and pagead. subdomains, and a subdomain we do not enumerate is
    // indistinguishable from a host that does not exist.
    //
    // gstatic.com serves the Google Ads call-tracking loader
    // (www.gstatic.com/wcm/loader.js, Website Call Metrics — the phone-number
    // swap). Nothing in this repo requests it; the GTM container injects it at
    // runtime, so it will never turn up in a grep of src/. www.google.com is
    // where Ads posts conversions (/pagead/1p-conversion, /ccm/collect) and
    // where that loader reports calls.
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://*.google-analytics.com https://google-analytics.com https://*.analytics.google.com https://analytics.google.com https://*.googletagmanager.com https://googletagmanager.com https://*.googleadservices.com https://googleadservices.com https://*.googlesyndication.com https://googlesyndication.com https://*.doubleclick.net https://doubleclick.net https://*.google.com https://google.com https://*.gstatic.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https://*.google-analytics.com https://google-analytics.com https://*.analytics.google.com https://analytics.google.com https://*.googletagmanager.com https://googletagmanager.com https://*.googleadservices.com https://googleadservices.com https://*.googlesyndication.com https://googlesyndication.com https://*.doubleclick.net https://doubleclick.net https://*.google.com https://google.com https://*.gstatic.com;
      font-src 'self';
      connect-src 'self' https://*.google-analytics.com https://google-analytics.com https://*.analytics.google.com https://analytics.google.com https://*.googletagmanager.com https://googletagmanager.com https://*.googleadservices.com https://googleadservices.com https://*.googlesyndication.com https://googlesyndication.com https://*.doubleclick.net https://doubleclick.net https://*.google.com https://google.com https://*.gstatic.com;
      frame-src 'self' https://*.googletagmanager.com https://googletagmanager.com https://*.googleadservices.com https://googleadservices.com https://*.googlesyndication.com https://googlesyndication.com https://*.doubleclick.net https://doubleclick.net https://*.google.com https://google.com https://*.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      upgrade-insecure-requests;
      report-uri /api/v1/csp-report;
      report-to csp;
    `
      .replace(/\s+/g, " ")
      .trim(),
  },
  {
    // Without a reporting endpoint a CSP violation is silent in production —
    // which is exactly how the two collection outages this policy's comments
    // describe went unnoticed until someone checked the GA property. `report-uri`
    // above is the deprecated-but-universally-supported form; this is the
    // modern one, and browsers that honour both send once.
    key: "Reporting-Endpoints",
    value: 'csp="/api/v1/csp-report"',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  staticPageGenerationTimeout: 120,
  headers: async () => {
    return [
      {
        // Apply these headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  compiler: {
    // `console.error`/`console.warn` are kept: stripping every console call
    // deleted the only signal for real production failures — the DB connect
    // handler in `src/lib/mongodb.ts`, the booking save, and the
    // release-holds cron all report through `console.error`, so Vercel's
    // runtime logs were blind for exactly the failures worth paging on.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  typescript: {
    // The build type-checks again. `npm run typecheck` (tsc --noEmit) is the
    // fast local gate; this is the one that stops a type error reaching prod.
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // These images change when the machines do, which is roughly never. At 60
    // seconds every variant was re-optimised about once a minute per region,
    // which is pure image-optimisation billing for no freshness benefit.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ["@heroicons/react"],
  },
  // No `webpack` key on purpose. A hand-rolled `splitChunks` used to replace
  // Next's App Router cache groups (framework/lib/commons/shared) with a
  // generic defaultVendors pair — strictly worse chunking — and it was inert
  // under `next dev --turbopack`, so dev and prod split differently.
};

export default nextConfig;
