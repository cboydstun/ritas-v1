/**
 * Fixed-window rate limiting for the public write endpoints.
 *
 * Every public POST route persists a document and fans out to Twilio and
 * Resend, so an unthrottled caller costs real money and burns sender
 * reputation. None of them had any limit at all.
 *
 * The default store is per-instance memory. That is genuinely useful — it
 * stops a single client hammering one warm instance — but it is not shared
 * across Fluid Compute instances, so a distributed flood can still get through
 * roughly (instances × limit) requests per window. Set UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN to get a shared counter instead; the code
 * switches automatically.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

type Counter = { count: number; expiresAt: number };

const memoryStore = new Map<string, Counter>();

/** Hard ceiling on distinct identifiers held in the fallback store. */
export const MEMORY_STORE_MAX = 5000;

/**
 * Keep the in-memory map from growing without bound on a long-lived instance.
 *
 * Evicting only *expired* counters was not a bound: a flood of distinct
 * identifiers produces entries that are all still live, so nothing could be
 * reclaimed, and the full O(N) sweep then ran on every subsequent request for
 * the rest of the window — unbounded memory plus quadratic CPU on the hot
 * path. Expired entries still go first; if that is not enough, the oldest
 * entries go too. Map iteration is insertion-ordered, so "oldest" is just the
 * front of the map, and evicting a live counter early only means its owner
 * gets a fresh window — the failure mode is leniency, not a crash.
 */
function pruneMemoryStore(now: number): void {
  if (memoryStore.size < MEMORY_STORE_MAX) return;

  for (const [key, counter] of memoryStore) {
    if (counter.expiresAt <= now) memoryStore.delete(key);
  }

  let excess = memoryStore.size - MEMORY_STORE_MAX;
  if (excess <= 0) return;
  for (const key of memoryStore.keys()) {
    memoryStore.delete(key);
    if (--excess <= 0) break;
  }
}

/**
 * Credentials for the shared limiter store, if one is configured.
 *
 * Two accepted spellings, deliberately. `UPSTASH_REDIS_REST_*` is what
 * Upstash's own docs use and what a manually-configured deployment sets;
 * `KV_REST_API_*` is what the Vercel Marketplace integration injects when the
 * Redis resource is provisioned through it. Reading only the first meant the
 * integration could be fully provisioned and connected while every request
 * silently fell through to the per-instance memory limiter — the failure mode
 * this store exists to remove, and an invisible one, because the fallback
 * works.
 *
 * Reading the integration's variables directly rather than duplicating them
 * under the other names keeps one source of truth: rotating the resource's
 * token in the Vercel dashboard flows through without a second edit.
 */
function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function incrementInRedis(
  key: string,
  windowSeconds: number,
): Promise<number | null> {
  const config = redisConfig();
  if (!config) return null;

  try {
    // Pipeline INCR + EXPIRE so the key always carries a TTL.
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSeconds), "NX"],
      ]),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const results = (await response.json()) as Array<{ result?: number }>;
    const count = results?.[0]?.result;
    return typeof count === "number" ? count : null;
  } catch (error) {
    // A limiter outage must not take the booking form down with it.
    console.error("Rate limit store unavailable, falling back:", error);
    return null;
  }
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000));
  const key = `ratelimit:${identifier}:${windowStart}`;

  const redisCount = await incrementInRedis(key, windowSeconds);
  if (redisCount !== null) {
    const resetAt = (windowStart + 1) * windowSeconds * 1000;
    return {
      allowed: redisCount <= limit,
      retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  pruneMemoryStore(now);

  const expiresAt = (windowStart + 1) * windowSeconds * 1000;
  const existing = memoryStore.get(key);
  const counter =
    existing && existing.expiresAt > now ? existing : { count: 0, expiresAt };

  counter.count += 1;
  memoryStore.set(key, counter);

  return {
    allowed: counter.count <= limit,
    retryAfter: Math.max(1, Math.ceil((counter.expiresAt - now) / 1000)),
  };
}

/**
 * Client identity for rate limiting, resolved from headers.
 *
 * The leftmost `x-forwarded-for` entry is whatever the *client* wrote — a
 * proxy appends, it does not overwrite. Keying every bucket in the app on it
 * meant a caller could rotate `X-Forwarded-For` per request and dissolve the
 * public-write caps (unbounded Twilio and Resend spend, unbounded inventory
 * holds) and, worse, the admin login throttle, leaving an unlimited brute
 * force against one credential with no lockout and no MFA.
 *
 * `x-vercel-forwarded-for` is set by the platform and cannot be forged by the
 * client, so it wins wherever it is present. `x-forwarded-for` remains the
 * fallback for local dev and self-hosted `next start`, where there is no
 * trusted proxy in front and nothing better to key on.
 */
export function identifierFromHeaders(
  get: (name: string) => string | null | undefined,
): string {
  const platform = get("x-vercel-forwarded-for");
  if (platform) {
    const first = platform.split(",")[0]?.trim();
    if (first) return first;
  }

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return get("x-real-ip")?.trim() || "unknown";
}

/** Client identity for a `Request`. See `identifierFromHeaders`. */
export function clientIdentifier(request: Request): string {
  return identifierFromHeaders((name) => request.headers.get(name));
}

/** Largest JSON body any public write route will read, in bytes. */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * Read and parse a JSON body, refusing anything oversized. Returns `null` when
 * the body is too large or not valid JSON so callers can answer 400/413.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<{ ok: true; data: unknown } | { ok: false; tooLarge: boolean }> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    // A header that isn't a number is malformed, not a licence to skip the cap.
    if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
      return { ok: false, tooLarge: true };
    }
  }

  // Without a Content-Length (chunked transfer) the declared check above is
  // skipped, and `request.text()` would materialise the whole payload before
  // the cap below could fire. Stream instead and stop at the ceiling.
  const body = request.body;
  let text: string;
  if (declared === null && body) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, tooLarge: true };
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    text = Buffer.concat(chunks).toString("utf8");
  } else {
    text = await request.text();
  }

  // `text.length` counts UTF-16 units, so a multi-byte payload could be about
  // three times the nominal cap before this check fired.
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    return { ok: false, tooLarge: true };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
