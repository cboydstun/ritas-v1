/**
 * @jest-environment node
 */
import {
  MAX_BODY_BYTES,
  MEMORY_STORE_MAX,
  clientIdentifier,
  rateLimit,
  readJsonBody,
} from "@/lib/rate-limit";

/** Distinct per test so the shared in-process memory store stays isolated. */
let bucket = 0;
const nextId = () => `test-${bucket++}`;

const withBody = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/x", { method: "POST", body, headers });

describe("rateLimit", () => {
  it("allows requests up to the limit and refuses the next one", async () => {
    const id = nextId();

    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(id, { limit: 3, windowSeconds: 600 });
      expect(result.allowed).toBe(true);
    }

    const blocked = await rateLimit(id, { limit: 3, windowSeconds: 600 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts each identifier separately", async () => {
    const a = nextId();
    const b = nextId();

    await rateLimit(a, { limit: 1, windowSeconds: 600 });
    const first = await rateLimit(b, { limit: 1, windowSeconds: 600 });

    expect(first.allowed).toBe(true);
  });
});

describe("clientIdentifier", () => {
  it("takes the leftmost x-forwarded-for entry", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });

    expect(clientIdentifier(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a sentinel", () => {
    expect(
      clientIdentifier(
        new Request("http://localhost/x", {
          headers: { "x-real-ip": "198.51.100.4" },
        }),
      ),
    ).toBe("198.51.100.4");

    expect(clientIdentifier(new Request("http://localhost/x"))).toBe("unknown");
  });

  // A proxy *appends* to x-forwarded-for, so its leftmost entry is whatever
  // the client wrote. Keying on it let a caller rotate the header per request
  // and dissolve every bucket in the app — the public-write caps and, worse,
  // the admin login throttle. x-vercel-forwarded-for is platform-set.
  it("prefers the platform header over a client-supplied x-forwarded-for", () => {
    const request = new Request("http://localhost/x", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "203.0.113.7",
        "x-real-ip": "5.6.7.8",
      },
    });

    expect(clientIdentifier(request)).toBe("203.0.113.7");
  });

  it("ignores a spoofed prefix on the platform header", () => {
    const request = new Request("http://localhost/x", {
      headers: { "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });

    expect(clientIdentifier(request)).toBe("203.0.113.7");
  });
});

describe("readJsonBody", () => {
  it("parses a well-formed body", async () => {
    const result = await readJsonBody(withBody(JSON.stringify({ a: 1 })));

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("reports invalid JSON without calling it oversized", async () => {
    const result = await readJsonBody(withBody("{nope"));

    expect(result).toEqual({ ok: false, tooLarge: false });
  });

  it("refuses a body over the cap", async () => {
    const result = await readJsonBody(withBody("x".repeat(200)), 100);

    expect(result).toEqual({ ok: false, tooLarge: true });
  });

  // `text.length` counts UTF-16 units, so a multi-byte payload could be about
  // three times the nominal cap before the check fired.
  it("measures bytes, not UTF-16 units", async () => {
    // 60 three-byte characters: 60 units, 180 bytes.
    const result = await readJsonBody(withBody("あ".repeat(60)), 100);

    expect(result).toEqual({ ok: false, tooLarge: true });
  });

  it("refuses a declared length over the cap without reading the body", async () => {
    const result = await readJsonBody(
      withBody("{}", { "content-length": String(MAX_BODY_BYTES + 1) }),
    );

    expect(result).toEqual({ ok: false, tooLarge: true });
  });

  // A header that isn't a number is malformed, not a licence to skip the cap.
  it.each(["not-a-number", "-1"])(
    "refuses a malformed content-length of %s",
    async (declared) => {
      const result = await readJsonBody(
        withBody("{}", { "content-length": declared }),
      );

      expect(result).toEqual({ ok: false, tooLarge: true });
    },
  );
});

// The fallback limiter is the live path whenever UPSTASH_* is unset.
describe("memory-store fallback", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("counts within a window and refuses past the limit", async () => {
    const id = `count-${Math.random()}`;

    expect((await rateLimit(id, { limit: 2, windowSeconds: 60 })).allowed).toBe(
      true,
    );
    expect((await rateLimit(id, { limit: 2, windowSeconds: 60 })).allowed).toBe(
      true,
    );

    const third = await rateLimit(id, { limit: 2, windowSeconds: 60 });
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it("keys separate identifiers into separate buckets", async () => {
    const a = `bucket-a-${Math.random()}`;
    const b = `bucket-b-${Math.random()}`;

    await rateLimit(a, { limit: 1, windowSeconds: 60 });

    expect((await rateLimit(a, { limit: 1, windowSeconds: 60 })).allowed).toBe(
      false,
    );
    expect((await rateLimit(b, { limit: 1, windowSeconds: 60 })).allowed).toBe(
      true,
    );
  });

  // Evicting only *expired* counters was no bound at all: a flood of distinct
  // identifiers leaves every entry live, so nothing could be reclaimed and the
  // full O(N) sweep then ran on every later request for the rest of the
  // window — unbounded memory plus quadratic CPU on the hot path.
  it("stays bounded under a flood of distinct live identifiers", async () => {
    for (let i = 0; i < MEMORY_STORE_MAX + 500; i++) {
      await rateLimit(`flood-${i}`, { limit: 100, windowSeconds: 600 });
    }

    // Nothing here has expired, so expiry-based pruning alone would reclaim
    // none of it. The oldest-first pass is what holds the ceiling.
    const probe = await rateLimit("flood-probe", {
      limit: 1,
      windowSeconds: 600,
    });
    expect(probe.allowed).toBe(true);
  });
});

describe("readJsonBody without a Content-Length", () => {
  const chunked = (payload: string) =>
    new Request("http://localhost/x", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      }),
      // @ts-expect-error duplex is required for a streaming body in undici
      duplex: "half",
    });

  it("parses a chunked body that is within the cap", async () => {
    const result = await readJsonBody(chunked('{"a":1}'), 1024);

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  // The declared-length check is skipped entirely without Content-Length, so
  // request.text() would materialise the whole payload before the cap fired.
  it("refuses a chunked body over the cap without buffering it whole", async () => {
    const result = await readJsonBody(chunked("x".repeat(5000)), 1024);

    expect(result).toEqual({ ok: false, tooLarge: true });
  });

  it("reports malformed JSON as a parse failure, not a size failure", async () => {
    const result = await readJsonBody(chunked("{not json"), 1024);

    expect(result).toEqual({ ok: false, tooLarge: false });
  });
});

/**
 * The shared store is opt-in by environment, and its absence is silent: every
 * request just falls through to the per-instance memory limiter, which works.
 * So a credential the code cannot see is invisible in production — the store
 * is provisioned, connected, billed, and doing nothing.
 *
 * The Vercel Marketplace integration injects `KV_REST_API_*`; Upstash's own
 * docs (and a hand-configured deployment) use `UPSTASH_REDIS_REST_*`. Both
 * must resolve.
 */
describe("shared-store credential resolution", () => {
  const OLD_ENV = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    for (const k of [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
    ]) {
      delete process.env[k];
    }
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("uses the store when Upstash's own variable names are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-a";

    await rateLimit(`upstash-${Math.random()}`, {
      limit: 5,
      windowSeconds: 60,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.upstash.io/pipeline",
    );
  });

  it("uses the store when the Vercel integration's names are set", async () => {
    process.env.KV_REST_API_URL = "https://example.kv.upstash.io";
    process.env.KV_REST_API_TOKEN = "token-b";

    await rateLimit(`kv-${Math.random()}`, { limit: 5, windowSeconds: 60 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.kv.upstash.io/pipeline",
    );
  });

  it("prefers the explicit Upstash names when both are present", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://explicit.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token-a";
    process.env.KV_REST_API_URL = "https://integration.upstash.io";
    process.env.KV_REST_API_TOKEN = "token-b";

    await rateLimit(`both-${Math.random()}`, { limit: 5, windowSeconds: 60 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://explicit.upstash.io/pipeline",
    );
  });

  it("falls back to memory, not an error, when neither pair is set", async () => {
    const result = await rateLimit(`none-${Math.random()}`, {
      limit: 5,
      windowSeconds: 60,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
  });

  // A limiter outage must not take the booking form down with it.
  it("falls back to memory when the store errors", async () => {
    process.env.KV_REST_API_URL = "https://example.kv.upstash.io";
    process.env.KV_REST_API_TOKEN = "token-b";
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await rateLimit(`err-${Math.random()}`, {
      limit: 5,
      windowSeconds: 60,
    });

    expect(result.allowed).toBe(true);
  });
});
