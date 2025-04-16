# Authentication Implementation Guide

This document outlines the implementation of NextAuth.js to replace the current Basic Authentication in the SATX Ritas application.

## Why NextAuth.js?

NextAuth.js provides several advantages over Basic Authentication:

1. **Secure Session Management**: Uses JWT or database sessions instead of sending credentials with every request
2. **Multiple Authentication Providers**: Supports various authentication methods (credentials, OAuth, email, etc.)
3. **Built-in CSRF Protection**: Automatically protects against cross-site request forgery
4. **TypeScript Support**: Includes type definitions for better development experience
5. **Customizable**: Extensive callback system for customizing authentication flow

## Implementation Steps

### 1. Install NextAuth.js

```bash
npm install next-auth
```

### 2. Create API Route for NextAuth.js

Create a file at `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt"; // For password comparison (install with npm install bcrypt)

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // In production, replace with database lookup and proper password hashing
        if (!credentials?.username || !credentials?.password) return null;

        // Compare with hashed password in production
        if (
          credentials.username === process.env.ADMIN_USERNAME &&
          credentials.password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: "1",
            name: "Admin",
            role: "admin",
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token) {
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 3. Configure Environment Variables

Add the following to your `.env.local` file:

```
NEXTAUTH_SECRET=your-secure-random-string
NEXTAUTH_URL=https://your-domain.com
```

For development:

```
NEXTAUTH_URL=http://localhost:3000
```

Generate a secure random string for NEXTAUTH_SECRET:

```bash
openssl rand -base64 32
```

### 4. Create Login Page

Create a file at `src/app/admin/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const result = await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid credentials');
    } else {
      router.push('/admin');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light dark:bg-charcoal">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white">
          Admin Login
        </h1>

        {error && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 5. Add SessionProvider to Layout

Update your root layout file to include the SessionProvider:

```typescript
// src/app/layout.tsx
'use client';

import { SessionProvider } from "next-auth/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

### 6. Update Middleware for Authentication

Replace the Basic Auth check in middleware with NextAuth.js session check:

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Redirect HTTP to HTTPS in production
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") !== "https"
  ) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = "https";
    secureUrl.host = request.headers.get("host") || request.nextUrl.host;
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
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Redirect to login if not authenticated or not an admin
    if (!token || token.role !== "admin") {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("callbackUrl", encodeURI(pathname));
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 7. Protect API Routes

For API routes that need authentication, use the `getServerSession` function:

```typescript
// Example: src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

export async function GET(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const rentals = await Rental.find({})
      .sort({ createdAt: -1 })
      .select("-__v");

    return NextResponse.json(rentals);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { message: "Failed to fetch orders" },
      { status: 500 },
    );
  }
}
```

### 8. Client-Side Authentication

Use the `useSession` hook to check authentication status in client components:

```typescript
'use client';

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function AdminComponent() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/admin/login');
    },
  });

  // Loading state
  if (status === "loading") {
    return <div>Loading...</div>;
  }

  // Session is guaranteed at this point
  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      {/* Admin content */}
    </div>
  );
}
```

## Security Considerations

1. **Password Storage**: Use bcrypt or Argon2 for password hashing
2. **JWT Secret**: Use a strong, random secret for NEXTAUTH_SECRET
3. **HTTPS**: Ensure cookies are only sent over HTTPS in production
4. **Session Duration**: Set appropriate session timeouts based on security requirements
5. **CSRF Protection**: NextAuth.js includes CSRF protection by default

## Migration Plan

1. Implement NextAuth.js alongside Basic Auth
2. Test thoroughly in development and staging environments
3. Switch middleware to use NextAuth.js authentication
4. Remove Basic Auth implementation
5. Update all protected routes to use NextAuth.js session checks

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/getting-started/introduction)
- [NextAuth.js with App Router](https://next-auth.js.org/configuration/nextjs#app-router)
- [NextAuth.js TypeScript Guide](https://next-auth.js.org/getting-started/typescript)
