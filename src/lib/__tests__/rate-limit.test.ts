/**
 * @jest-environment node
 */
import {
  MAX_BODY_BYTES,
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
