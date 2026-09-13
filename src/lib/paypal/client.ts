/**
 * PayPal Orders v2, over plain `fetch`.
 *
 * There is deliberately no server SDK. `@paypal/checkout-server-sdk` is
 * deprecated upstream, and the version this repo used to carry was wrapped in
 * a hand-rolled "development mode workaround" that reimplemented the HTTP
 * layer badly and logged the SDK's credential structure. Four endpoints over
 * `fetch` is less code than the wrapper was.
 */

/**
 * Live only, on purpose — there is no environment switch that could reach
 * production pointing at the wrong place.
 *
 * Exported so a developer verifying the flow locally can point this one line
 * at `https://api-m.sandbox.paypal.com` for the duration, which is the whole
 * of the concession to having no sandbox mode.
 */
export const PAYPAL_API_BASE = "https://api-m.paypal.com";

/** Bounds every PayPal call; capture is on the customer's critical path. */
const PAYPAL_TIMEOUT_MS = 10_000;

/** Refresh a little before expiry rather than racing it. */
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount?: PayPalAmount;
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: {
    payments?: { captures?: PayPalCapture[] };
  }[];
}

/**
 * A PayPal API failure.
 *
 * `debug_id` is the only thing PayPal support will ask for, so it is carried
 * separately and logged. The response **body** is not: it can echo payer
 * identifiers, and this app does not put those in its logs.
 */
export class PayPalError extends Error {
  readonly status: number;
  readonly issue?: string;
  readonly debugId?: string;

  constructor(
    message: string,
    opts: { status: number; issue?: string; debugId?: string },
  ) {
    super(message);
    this.name = "PayPalError";
    this.status = opts.status;
    this.issue = opts.issue;
    this.debugId = opts.debugId;
  }
}

/** True when both halves of the credential are present. */
export function paypalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Test seam. The cache is module scope and would otherwise leak between cases. */
export function resetPayPalTokenCache(): void {
  cachedToken = null;
}

/** The `issue` and `debug_id` out of a PayPal error body, if it has them. */
function describeFailure(body: unknown): { issue?: string; debugId?: string } {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const debugId =
    typeof record.debug_id === "string" ? record.debug_id : undefined;

  const details = Array.isArray(record.details) ? record.details : [];
  const first = details[0];
  const fromDetails =
    first && typeof first === "object"
      ? (first as Record<string, unknown>).issue
      : undefined;

  const issue =
    typeof fromDetails === "string"
      ? fromDetails
      : typeof record.name === "string"
        ? record.name
        : undefined;

  return { issue, debugId };
}

/**
 * OAuth2 client-credentials token, cached across warm invocations the way
 * `src/lib/mongodb.ts` caches its connection.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PayPalError("PayPal is not configured", { status: 503 });
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const { issue, debugId } = describeFailure(body);
    throw new PayPalError("PayPal authentication failed", {
      status: response.status,
      issue,
      debugId,
    });
  }

  const token = (body as { access_token?: string; expires_in?: number } | null)
    ?.access_token;
  if (!token) {
    throw new PayPalError("PayPal returned no access token", {
      status: response.status,
    });
  }

  const expiresIn =
    (body as { expires_in?: number }).expires_in ?? 32_400; /* PayPal's 9h */
  cachedToken = {
    value: token,
    expiresAt: now + expiresIn * 1000 - TOKEN_EXPIRY_SKEW_MS,
  };
  return token;
}

/**
 * One authenticated PayPal call.
 *
 * A 401 clears the cached token and retries **once**: without that, rotating
 * the credential kills every request on a warm instance until the platform
 * happens to recycle it.
 */
async function paypalFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; requestId?: string },
  retryOn401 = true,
): Promise<T> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // PayPal's own idempotency key. The buyer can legitimately re-enter the
  // flow, and a retried create must not mint a second order.
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;

  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(PAYPAL_TIMEOUT_MS),
  });

  if (response.status === 401 && retryOn401) {
    resetPayPalTokenCache();
    return paypalFetch<T>(path, init, false);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const { issue, debugId } = describeFailure(body);
    throw new PayPalError(`PayPal ${init.method} ${path} failed`, {
      status: response.status,
      issue,
      debugId,
    });
  }

  return body as T;
}

/** PayPal's name for "you already captured this order". Not an error to us. */
export const ORDER_ALREADY_CAPTURED = "ORDER_ALREADY_CAPTURED";

/**
 * The issues PayPal returns when a capture fails because the *funding source*
 * said no, rather than because anything is wrong with the request.
 *
 * They arrive as a `422`, not as a `201` carrying a `DECLINED` capture — both
 * shapes are real and the capture route handles both. Left unnamed, a declined
 * card fell through to the generic failure path and told the buyer to phone us
 * while their money was untouched and a second card was in their hand.
 */
export const INSTRUMENT_DECLINED = "INSTRUMENT_DECLINED";
export const TRANSACTION_REFUSED = "TRANSACTION_REFUSED";
/** The buyer must go back to PayPal and confirm; retrying alone cannot fix it. */
export const PAYER_ACTION_REQUIRED = "PAYER_ACTION_REQUIRED";

export interface CreateOrderInput {
  /** Already rounded by `computeOrderTotal`; `toFixed` here only formats. */
  amountUsd: number;
  bookingId: string;
  /** Distinguishes a deliberate re-attempt from a retried request. */
  requestId: string;
}

export async function createPayPalOrder(
  input: CreateOrderInput,
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    requestId: input.requestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          // `custom_id` and not `invoice_id`: a buyer who cancels and comes
          // back reuses the same booking, and PayPal rejects a repeated
          // `invoice_id` with DUPLICATE_INVOICE_ID.
          custom_id: input.bookingId,
          description: `SATX Ritas rental ${input.bookingId}`,
          amount: {
            currency_code: "USD",
            value: input.amountUsd.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            // We already collected and service-area gated a delivery address.
            // Without this PayPal shows an address selector and collects a
            // second one that nothing reads.
            shipping_preference: "NO_SHIPPING",
            // Otherwise the button reads "Continue" rather than "Pay Now".
            user_action: "PAY_NOW",
            brand_name: "SATX Ritas Rentals",
          },
        },
      },
    },
  });
}

export async function capturePayPalOrder(
  orderId: string,
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    { method: "POST", body: {} },
  );
}

/**
 * Read an order back.
 *
 * Load-bearing rather than a convenience: it is how a capture that returned
 * `ORDER_ALREADY_CAPTURED` — or one that timed out, which is an unknown and
 * not a failure — is resolved without re-POSTing a capture blind.
 */
export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    { method: "GET" },
  );
}

/** The first capture on an order, which is the only one this app ever makes. */
export function firstCapture(order: PayPalOrder): PayPalCapture | null {
  return order.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
}
