import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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
            return new NextResponse(
                JSON.stringify({ message: "Unauthorized" }),
                {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                        "WWW-Authenticate": 'Basic realm="Secure Area"',
                    },
                }
            );
        }

        const authValue = basicAuth.split(" ")[1];
        const [user, pwd] = atob(authValue).split(":");

        if (
            user !== process.env.ADMIN_USERNAME ||
            pwd !== process.env.ADMIN_PASSWORD
        ) {
            return new NextResponse(
                JSON.stringify({ message: "Unauthorized" }),
                {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                        "WWW-Authenticate": 'Basic realm="Secure Area"',
                    },
                }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*", "/api/admin/:path*"],
};
