import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { Logger } from "next-axiom";

// Define permanent redirects
const PERMANENT_REDIRECTS: Record<string, string> = {
  // Add permanent redirects here as needed
  // "/old-page": "/new-page",
  // "/legacy": "/modern",
};

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const logger = new Logger({ source: "middleware" });
  await logger.middleware(request, { logRequestDetails: ["body", "nextUrl"] });
  // Check for permanent redirects
  const pathname = request.nextUrl.pathname;
  const redirectTo = PERMANENT_REDIRECTS[pathname];
  if (redirectTo) {
    const url = new URL(redirectTo, request.url);
    return NextResponse.redirect(url, { status: 301 });
  }

  // Check if the request is for an admin route
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // For now, we'll use basic auth
    // In production, you should implement proper authentication
    const basicAuth = request.headers.get("authorization");

    if (!basicAuth) {
      return new NextResponse(null, {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      });
    }

    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    // Use environment variables for credentials
    // Add ADMIN_USERNAME=admin and ADMIN_PASSWORD=your-secure-password to .env.local
    if (
      user !== process.env.ADMIN_USERNAME ||
      pwd !== process.env.ADMIN_PASSWORD
    ) {
      return new NextResponse(null, {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      });
    }
  }

  // Also protect admin API routes
  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    // For API routes, we'll check the same basic auth
    const basicAuth = request.headers.get("authorization");

    if (!basicAuth) {
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      });
    }

    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    if (
      user !== process.env.ADMIN_USERNAME ||
      pwd !== process.env.ADMIN_PASSWORD
    ) {
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
      });
    }
  }

  event.waitUntil(logger.flush());
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
