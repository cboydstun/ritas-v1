/**
 * @jest-environment node
 */
import bcrypt from "bcrypt";
import type { CredentialsConfig } from "next-auth/providers/credentials";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * The admin authentication surface, which nothing exercised before.
 *
 * Every invariant here is one a refactor can silently invert without breaking
 * a type or another test: the bcrypt-vs-plaintext branch, the constant-time
 * comparisons, the deliberate "always run the password check" ordering that
 * keeps a wrong username from being distinguishable by timing, and the IP
 * throttle. `timingSafeEquals` and `rateLimit` are covered on their own — what
 * was untested is precisely how `authorize` composes them.
 */

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn(),
}));

const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>;

const ENV_KEYS = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_PASSWORD_HASH",
] as const;

const originalEnv: Record<string, string | undefined> = {};

/**
 * next-auth v4's `CredentialsProvider()` returns a stub whose `authorize` is
 * `() => null` and stashes the caller's config under `.options`; the two are
 * merged only inside next-auth at request time. Reading `.authorize` off the
 * provider directly therefore tests the stub, not this app's code.
 *
 * `authorize` and `verifyPassword` both read `process.env` at call time rather
 * than at module load, so one import serves every env permutation below.
 */
const authorize = (
  authOptions.providers[0] as CredentialsConfig & {
    options: CredentialsConfig;
  }
).options.authorize!;

const req = (headers: Record<string, string> = {}) =>
  ({ headers }) as unknown as Parameters<
    NonNullable<CredentialsConfig["authorize"]>
  >[1];

describe("authOptions credentials authorize", () => {
  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.ADMIN_USERNAME = "admin";
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    jest.restoreAllMocks();
  });

  describe("bcrypt hash path", () => {
    it("accepts the correct password against ADMIN_PASSWORD_HASH", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      const user = await authorize(
        { username: "admin", password: "s3cret" },
        req(),
      );

      expect(user).toEqual({ id: "1", name: "Admin", role: "admin" });
    });

    it("rejects a wrong password", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      expect(
        await authorize({ username: "admin", password: "wrong" }, req()),
      ).toBeNull();
    });

    it("rejects rather than throwing when the hash is malformed", async () => {
      process.env.ADMIN_PASSWORD_HASH = "not-a-bcrypt-hash";

      expect(
        await authorize({ username: "admin", password: "s3cret" }, req()),
      ).toBeNull();
    });

    it("ignores the plaintext fallback when a hash is set", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);
      process.env.ADMIN_PASSWORD = "plaintext";

      expect(
        await authorize({ username: "admin", password: "plaintext" }, req()),
      ).toBeNull();
    });
  });

  describe("legacy plaintext fallback", () => {
    it("accepts the correct password and warns", async () => {
      process.env.ADMIN_PASSWORD = "plaintext";

      const user = await authorize(
        { username: "admin", password: "plaintext" },
        req(),
      );

      expect(user).toEqual({ id: "1", name: "Admin", role: "admin" });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("ADMIN_PASSWORD_HASH is not set"),
      );
    });

    it("rejects when neither a hash nor a plaintext password is configured", async () => {
      expect(
        await authorize({ username: "admin", password: "anything" }, req()),
      ).toBeNull();
    });
  });

  describe("username and credential shape", () => {
    it("rejects when ADMIN_USERNAME is unset", async () => {
      delete process.env.ADMIN_USERNAME;
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      expect(
        await authorize({ username: "admin", password: "s3cret" }, req()),
      ).toBeNull();
    });

    it("rejects a wrong username even with the right password", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      expect(
        await authorize({ username: "root", password: "s3cret" }, req()),
      ).toBeNull();
    });

    it.each([
      ["missing password", { username: "admin", password: "" }],
      ["missing username", { username: "", password: "s3cret" }],
      ["no credentials", undefined],
    ])("rejects %s without consulting the rate limiter", async (_l, creds) => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      expect(await authorize(creds, req())).toBeNull();
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("still runs the password check when the username is wrong", async () => {
      // The timing oracle this guards against: short-circuiting on the
      // username would make a wrong username measurably faster than a wrong
      // password, and no other test would fail.
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);
      const compare = jest.spyOn(bcrypt, "compare");

      await authorize({ username: "root", password: "s3cret" }, req());

      expect(compare).toHaveBeenCalledTimes(1);
      compare.mockRestore();
    });
  });

  describe("login throttling", () => {
    it("rejects a throttled caller before checking the password", async () => {
      mockRateLimit.mockResolvedValue({ allowed: false, retryAfter: 600 });
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);
      const compare = jest.spyOn(bcrypt, "compare");

      expect(
        await authorize({ username: "admin", password: "s3cret" }, req()),
      ).toBeNull();
      expect(compare).not.toHaveBeenCalled();
      compare.mockRestore();
    });

    it("keys the limit on the first x-forwarded-for hop", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      await authorize(
        { username: "admin", password: "s3cret" },
        req({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }),
      );

      expect(mockRateLimit).toHaveBeenCalledWith("admin-login:203.0.113.7", {
        limit: 10,
        windowSeconds: 600,
      });
    });

    it("falls back to x-real-ip, then to a constant", async () => {
      process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("s3cret", 4);

      await authorize(
        { username: "admin", password: "s3cret" },
        req({ "x-real-ip": "198.51.100.4" }),
      );
      expect(mockRateLimit).toHaveBeenCalledWith(
        "admin-login:198.51.100.4",
        expect.anything(),
      );

      await authorize({ username: "admin", password: "s3cret" }, req());
      expect(mockRateLimit).toHaveBeenCalledWith(
        "admin-login:unknown",
        expect.anything(),
      );
    });
  });
});

describe("authOptions callbacks", () => {
  it("carries the role from user to token to session", async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const session = authOptions.callbacks!.session!;

    const token = await jwt({
      token: {},
      user: { id: "1", name: "Admin", role: "admin" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    expect(token.role).toBe("admin");

    const result = (await session({
      session: { user: {}, expires: "" },
      token,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as { user?: { role?: string } };
    expect(result.user?.role).toBe("admin");
  });
});
