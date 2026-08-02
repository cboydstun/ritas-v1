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
    // same silent way if unlisted.
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://*.google-analytics.com https://*.googletagmanager.com https://www.googleadservices.com;
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https://*.google-analytics.com https://google-analytics.com https://*.googletagmanager.com https://*.analytics.google.com https://analytics.google.com https://www.google.com https://*.doubleclick.net https://doubleclick.net https://www.googleadservices.com;
      font-src 'self';
      connect-src 'self' https://*.google-analytics.com https://google-analytics.com https://*.googletagmanager.com https://*.analytics.google.com https://analytics.google.com https://*.doubleclick.net https://doubleclick.net https://www.googleadservices.com;
      frame-src 'self' https://*.googletagmanager.com https://www.google.com https://*.doubleclick.net https://www.googleadservices.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      upgrade-insecure-requests;
    `
      .replace(/\s+/g, " ")
      .trim(),
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
    removeConsole: process.env.NODE_ENV === "production",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: ["@heroicons/react"],
  },
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        mergeDuplicateChunks: true,
        minimize: true,
        splitChunks: {
          chunks: "all",
          minSize: 20000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
