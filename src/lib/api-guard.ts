import { NextResponse } from "next/server";
import {
  MAX_BODY_BYTES,
  clientIdentifier,
  rateLimit,
  readJsonBody,
} from "@/lib/rate-limit";

/**
 * Shared front door for the public write endpoints: rate limit, cap the body
 * size, and parse JSON — returning a ready-made error response when any of
 * those fail so route handlers stay focused on their own logic.
 */
export interface PublicWriteOptions {
  /** Bucket name, so limits are counted per endpoint rather than globally. */
  route: string;
  limit: number;
  windowSeconds: number;
  maxBytes?: number;
}

export type PublicWriteGuard =
  { ok: true; data: unknown } | { ok: false; response: NextResponse };

export async function guardPublicWrite(
  request: Request,
  options: PublicWriteOptions,
): Promise<PublicWriteGuard> {
  const identifier = `${options.route}:${clientIdentifier(request)}`;
  const { allowed, retryAfter } = await rateLimit(identifier, {
    limit: options.limit,
    windowSeconds: options.windowSeconds,
  });

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  const body = await readJsonBody(request, options.maxBytes ?? MAX_BODY_BYTES);
  if (!body.ok) {
    return {
      ok: false,
      response: body.tooLarge
        ? NextResponse.json({ message: "Request too large" }, { status: 413 })
        : NextResponse.json({ message: "Invalid JSON body" }, { status: 400 }),
    };
  }

  return { ok: true, data: body.data };
}
