/**
 * @jest-environment node
 */
import { guardAdminWrite, guardPublicWrite } from "@/lib/api-guard";

const jsonRequest = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

describe("guardPublicWrite", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const options = (route: string) => ({
    route,
    limit: 2,
    windowSeconds: 600,
  });

  it("passes a well-formed body through", async () => {
    const result = await guardPublicWrite(
      jsonRequest('{"a":1}', { "x-forwarded-for": `1.1.1.${Math.random()}` }),
      options(`pass-${Math.random()}`),
    );

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });

  it("answers 429 with a Retry-After once the bucket is spent", async () => {
    const route = `spend-${Math.random()}`;
    const ip = "203.0.113.9";
    const call = () =>
      guardPublicWrite(
        jsonRequest("{}", { "x-vercel-forwarded-for": ip }),
        options(route),
      );

    await call();
    await call();
    const result = await call();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the guard to refuse");
    expect(result.response.status).toBe(429);
    expect(result.response.headers.get("Retry-After")).toBeTruthy();
  });

  it("answers 413 for an oversized body", async () => {
    const result = await guardPublicWrite(
      jsonRequest(JSON.stringify({ a: "x".repeat(2000) }), {
        "x-vercel-forwarded-for": `198.51.100.${Math.random()}`,
      }),
      { ...options(`large-${Math.random()}`), maxBytes: 100 },
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the guard to refuse");
    expect(result.response.status).toBe(413);
  });

  it("answers 400 for a malformed body", async () => {
    const result = await guardPublicWrite(
      jsonRequest("{nope", {
        "x-vercel-forwarded-for": `198.51.100.${Math.random()}`,
      }),
      options(`bad-${Math.random()}`),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the guard to refuse");
    expect(result.response.status).toBe(400);
  });
});

// Admin handlers read the body directly, so MAX_BODY_BYTES never applied to
// them. Post-auth this bounds a compromised session rather than closing an
// entry point, which is why there is no rate limit on this path.
describe("guardAdminWrite", () => {
  it("passes a well-formed body through", async () => {
    expect(
      await guardAdminWrite(jsonRequest('{"status":"cancelled"}')),
    ).toEqual({ ok: true, data: { status: "cancelled" } });
  });

  it("answers 413 for an oversized body", async () => {
    const result = await guardAdminWrite(
      jsonRequest(JSON.stringify({ a: "x".repeat(2000) })),
      100,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the guard to refuse");
    expect(result.response.status).toBe(413);
  });

  it("answers 400 for a malformed body", async () => {
    const result = await guardAdminWrite(jsonRequest("{nope"));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected the guard to refuse");
    expect(result.response.status).toBe(400);
  });

  it("does not rate limit repeated admin writes", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await guardAdminWrite(jsonRequest("{}"))).ok).toBe(true);
    }
  });
});
