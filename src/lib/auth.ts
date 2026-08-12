import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { rateLimit, identifierFromHeaders } from "@/lib/rate-limit";
import { timingSafeEquals } from "@/lib/timing-safe";

/**
 * Checks the candidate against the bcrypt hash in ADMIN_PASSWORD_HASH.
 *
 * There is deliberately no plaintext fallback. ADMIN_PASSWORD used to be
 * accepted when the hash was unset, which meant a typo'd or dropped hash
 * silently downgraded admin auth to a plaintext comparison, and kept a
 * second copy of the credential sitting in the environment for any env-var
 * leak to pick up. Generate a hash with:
 *   node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'pw'
 */
async function verifyPassword(candidate: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error(
      "ADMIN_PASSWORD_HASH is not set — admin login is disabled until it is.",
    );
    return false;
  }

  try {
    return await bcrypt.compare(candidate, hash);
  } catch (error) {
    console.error("ADMIN_PASSWORD_HASH is not a valid bcrypt hash:", error);
    return false;
  }
}

/**
 * Client IP for login throttling.
 *
 * Shares `identifierFromHeaders` with the public-write limiter so both agree
 * on which headers are trustworthy — this used to be a second, divergent copy
 * that keyed the brute-force throttle on a client-writable header.
 */
function loginIdentifier(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | undefined> })
    ?.headers;
  return identifierFromHeaders((name) => headers?.[name]);
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
