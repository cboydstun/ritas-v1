import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { SITE_URL } from "@/lib/site";

/** The one host this app will redirect to, taken from the canonical origin. */
function allowedHost(): string | null {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return null;
  }
}

// Define permanent redirects
const PERMANENT_REDIRECTS: Record<string, string> = {
  // Add permanent redirects here as needed
  // "/old-page": "/new-page",
  // "/legacy": "/modern",
};

export async function proxy(request: NextRequest) {
  // Redirect HTTP to HTTPS in production
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") !== "https"
  ) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https";
    // Deliberately NOT the Host header: trusting it turned this into a
    // cacheable open redirect (`Host: evil.com` + `x-forwarded-proto: http`
    // returned a 301 to https://evil.com/<path>).
    secureUrl.host = allowedHost() ?? request.nextUrl.host;
    return NextResponse.redirect(secureUrl, { status: 301 });
  }

  // Check for permanent redirects
  const pathname = request.nextUrl.pathname;
  const redirectTo = PERMANENT_REDIRECTS[pathname];
  if (redirectTo) {
    const url = new URL(redirectTo, request.url);
    return NextResponse.redirect(url, { status: 301 });
  }

  // Check if the request is for an admin route
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // Skip auth check for login page
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    // Get the NextAuth.js token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Redirect to login if not authenticated or not an admin
    if (!token || token.role !== "admin") {
      // For API routes, return a JSON response
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      // For admin UI routes, redirect to login page
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("callbackUrl", encodeURI(pathname));
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Scoped to the routes this proxy actually protects. It previously ran
  // on every public request — including every static page — purely to consult
  // an empty PERMANENT_REDIRECTS map. Vercel already forces HTTPS at the edge,
  // and HSTS is set in next.config.ts.
  //
  // Note: adding a public-page entry to PERMANENT_REDIRECTS means widening
  // this matcher to cover it.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
