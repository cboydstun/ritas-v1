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

/** Keep the in-memory map from growing without bound on a long-lived instance. */
function pruneMemoryStore(now: number): void {
  if (memoryStore.size < 5000) return;
  for (const [key, counter] of memoryStore) {
    if (counter.expiresAt <= now) memoryStore.delete(key);
  }
}

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
 * Best-effort client identity. Vercel sets `x-forwarded-for`; the leftmost
 * entry is the original client.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
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
  if (declared && Number(declared) > maxBytes) {
    return { ok: false, tooLarge: true };
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    return { ok: false, tooLarge: true };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}
