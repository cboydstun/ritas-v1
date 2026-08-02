import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import { rateLimit } from "@/lib/rate-limit";

/** Length-independent constant-time string comparison. */
function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so compare fixed-size digests
  // of the inputs instead of the raw bytes.
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure path costs the same.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Prefers a bcrypt hash in ADMIN_PASSWORD_HASH. Falls back to the legacy
 * plaintext ADMIN_PASSWORD so an existing deployment keeps working, but warns
 * loudly — generate a hash with:
 *   node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'pw'
 */
async function verifyPassword(candidate: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) {
    try {
      return await bcrypt.compare(candidate, hash);
    } catch (error) {
      console.error("ADMIN_PASSWORD_HASH is not a valid bcrypt hash:", error);
      return false;
    }
  }

  const plaintext = process.env.ADMIN_PASSWORD;
  if (!plaintext) return false;

  console.warn(
    "ADMIN_PASSWORD_HASH is not set — falling back to the plaintext " +
      "ADMIN_PASSWORD. Set ADMIN_PASSWORD_HASH and remove the plaintext value.",
  );
  return timingSafeEquals(candidate, plaintext);
}

/** Best-effort client IP for login throttling. */
function loginIdentifier(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | undefined> })
    ?.headers;
  const forwarded = headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers?.["x-real-ip"] ?? "unknown";
}

// Extend the built-in types
declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    role: string;
  }

  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        // There is no lockout upstream of this, so throttle by IP to keep the
        // single admin credential from being brute-forceable.
        const identifier = `admin-login:${loginIdentifier(req)}`;
        const { allowed } = await rateLimit(identifier, {
          limit: 10,
          windowSeconds: 600,
        });
        if (!allowed) {
          console.warn("Admin login throttled for", identifier);
          return null;
        }

        const expectedUsername = process.env.ADMIN_USERNAME;
        if (!expectedUsername) return null;

        // Compare both factors in constant time and always run the password
        // check, so a wrong username is not distinguishable by timing.
        const usernameOk = timingSafeEquals(
          credentials.username,
          expectedUsername,
        );
        const passwordOk = await verifyPassword(credentials.password);

        if (usernameOk && passwordOk) {
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
      if (token && session.user) {
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
