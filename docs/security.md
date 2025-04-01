# Security Implementation Guide

This document outlines the security measures implemented in the SATX Ritas application, focusing on HTTPS enforcement and security headers.

## HTTPS Enforcement

HTTPS is enforced for all traffic in production environments through two mechanisms:

1. **Middleware Redirect**: The application uses Next.js middleware to automatically redirect all HTTP requests to HTTPS.

   ```typescript
   // src/middleware.ts
   if (
     process.env.NODE_ENV === "production" &&
     request.headers.get("x-forwarded-proto") !== "https"
   ) {
     const secureUrl = request.nextUrl.clone();
     secureUrl.protocol = "https";
     secureUrl.host = request.headers.get("host") || request.nextUrl.host;
     return NextResponse.redirect(secureUrl, { status: 301 });
   }
   ```

2. **Upgrade-Insecure-Requests Header**: The Content-Security-Policy includes the `upgrade-insecure-requests` directive, which instructs browsers to upgrade HTTP requests to HTTPS.

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

A comprehensive CSP is implemented to prevent XSS attacks and other code injection vulnerabilities:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.paypal.com https://www.google-analytics.com; font-src 'self'; connect-src 'self' https://*.paypal.com https://www.google-analytics.com; frame-src 'self' https://*.paypal.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; block-all-mixed-content; upgrade-insecure-requests;
```

Key directives:

- `default-src 'self'`: Only allow resources from the same origin
- `script-src`: Restricts JavaScript sources to same origin, inline scripts, and specific domains (PayPal, Google Analytics)
- `style-src`: Allows styles from same origin and inline styles
- `img-src`: Allows images from same origin, data URIs, and specific domains
- `connect-src`: Controls which URLs can be loaded using script interfaces
- `frame-src`: Restricts iframe sources
- `object-src 'none'`: Prevents object, embed, and applet elements
- `block-all-mixed-content`: Blocks mixed (HTTP/HTTPS) content
- `upgrade-insecure-requests`: Upgrades HTTP requests to HTTPS

### Additional Security Headers

```
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- `X-XSS-Protection`: Enables browser's XSS filtering
- `X-Content-Type-Options`: Prevents MIME type sniffing
- `Referrer-Policy`: Controls referrer information
- `X-Frame-Options`: Prevents clickjacking by restricting framing
- `Permissions-Policy`: Restricts access to browser features

## Implementation Details

These security measures are implemented in:

1. **Middleware** (`src/middleware.ts`): Handles HTTP to HTTPS redirects
2. **Next.js Config** (`next.config.ts`): Configures security headers

## Testing Security Headers

You can verify the security headers using:

1. Browser Developer Tools (Network tab)
2. Online tools like [Security Headers](https://securityheaders.com/)
3. [Mozilla Observatory](https://observatory.mozilla.org/)

## Development Considerations

- Security headers are applied in all environments, but HTTPS redirects only occur in production
- The CSP allows 'unsafe-inline' and 'unsafe-eval' for development convenience, but these should be restricted further in a high-security environment
- PayPal and Google Analytics domains are explicitly allowed in the CSP

## Future Enhancements

Consider implementing:

1. **Subresource Integrity (SRI)** for external scripts
2. **Feature-Policy** for more granular control of browser features
3. **Report-To** and **Report-URI** for CSP violation reporting
4. **Certificate Transparency** monitoring
5. Further restricting the CSP by removing 'unsafe-inline' and 'unsafe-eval' where possible
