/**
 * @jest-environment node
 */
import {
  ORDER_ALREADY_CAPTURED,
  PAYPAL_API_BASE,
  PayPalError,
  capturePayPalOrder,
  createPayPalOrder,
  firstCapture,
  getPayPalOrder,
  isPayPalAuthFailure,
  paypalConfigured,
  payPalErrorDetail,
  resetPayPalClientIdWarning,
  resetPayPalTokenCache,
  warnOnClientIdMismatch,
} from "../client";

const ORIGINAL_ENV = process.env;

/** A successful OAuth response, good for an hour. */
const tokenResponse = (value = "tok-1", expiresIn = 3600) => ({
  ok: true,
  status: 200,
  json: async () => ({ access_token: value, expires_in: expiresIn }),
});

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const fetchMock = jest.fn();

/** The parsed request body of the nth fetch call. */
const bodyOf = (call: number) =>
  JSON.parse(fetchMock.mock.calls[call][1].body as string);

/** The headers of the nth fetch call. */
const headersOf = (call: number): Record<string, string> =>
  fetchMock.mock.calls[call][1].headers;

describe("PayPal client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPayPalTokenCache();
    process.env = {
      ...ORIGINAL_ENV,
      PAYPAL_CLIENT_ID: "client-id",
      PAYPAL_CLIENT_SECRET: "client-secret",
    };
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("paypalConfigured", () => {
    it("needs both halves of the credential", () => {
      expect(paypalConfigured()).toBe(true);

      delete process.env.PAYPAL_CLIENT_SECRET;
      expect(paypalConfigured()).toBe(false);

      process.env.PAYPAL_CLIENT_SECRET = "s";
      delete process.env.PAYPAL_CLIENT_ID;
      expect(paypalConfigured()).toBe(false);
    });
  });

  describe("access token", () => {
    it("authenticates with HTTP Basic against the live host", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));

      await createPayPalOrder({
        amountUsd: 10,
        bookingId: "B1",
        requestId: "r1",
      });

      expect(fetchMock.mock.calls[0][0]).toBe(
        `${PAYPAL_API_BASE}/v1/oauth2/token`,
      );
      const basic = Buffer.from("client-id:client-secret").toString("base64");
      expect(headersOf(0).Authorization).toBe(`Basic ${basic}`);
      expect(fetchMock.mock.calls[0][1].body).toBe(
        "grant_type=client_credentials",
      );
    });

    // A token request per capture is latency on the customer's critical path.
    it("reuses a cached token across calls", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }))
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));

      await getPayPalOrder("ORDER-1");
      await getPayPalOrder("ORDER-1");

      const tokenCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/v1/oauth2/token"),
      );
      expect(tokenCalls).toHaveLength(1);
    });

    // The skew is 60s, so a token valid for 30 is already stale.
    it("refetches a token that is inside the expiry skew", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse("tok-1", 30))
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }))
        .mockResolvedValueOnce(tokenResponse("tok-2", 3600))
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));

      await getPayPalOrder("ORDER-1");
      await getPayPalOrder("ORDER-1");

      const tokenCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/v1/oauth2/token"),
      );
      expect(tokenCalls).toHaveLength(2);
      expect(headersOf(3).Authorization).toBe("Bearer tok-2");
    });

    it("refuses to call PayPal at all when unconfigured", async () => {
      delete process.env.PAYPAL_CLIENT_ID;

      await expect(getPayPalOrder("ORDER-1")).rejects.toBeInstanceOf(
        PayPalError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reports an authentication failure as a PayPalError", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: "invalid_client", debug_id: "dbg-1" }, 401),
      );

      await expect(getPayPalOrder("ORDER-1")).rejects.toMatchObject({
        name: "PayPalError",
        status: 401,
        debugId: "dbg-1",
      });
    });

    it("rejects when PayPal answers 200 with no token", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await expect(getPayPalOrder("ORDER-1")).rejects.toBeInstanceOf(
        PayPalError,
      );
    });

    // Rotating the credential otherwise kills every request on a warm
    // instance until the platform happens to recycle it.
    it("clears the cache and retries once on a 401", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse("stale"))
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(tokenResponse("fresh"))
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));

      await expect(getPayPalOrder("ORDER-1")).resolves.toMatchObject({
        id: "ORDER-1",
      });
      expect(headersOf(3).Authorization).toBe("Bearer fresh");
    });

    it("gives up after one 401 retry rather than looping", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse("stale"))
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(tokenResponse("fresh"))
        .mockResolvedValueOnce(jsonResponse({ debug_id: "dbg-2" }, 401));

      await expect(getPayPalOrder("ORDER-1")).rejects.toMatchObject({
        status: 401,
        debugId: "dbg-2",
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("createPayPalOrder", () => {
    beforeEach(() => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));
    });

    it("sends the amount as a two-decimal string", async () => {
      await createPayPalOrder({
        amountUsd: 183.9,
        bookingId: "B1",
        requestId: "r1",
      });

      expect(bodyOf(1).purchase_units[0].amount).toEqual({
        currency_code: "USD",
        value: "183.90",
      });
    });

    // `invoice_id` would collide the moment a buyer cancels and comes back to
    // the same booking — PayPal answers DUPLICATE_INVOICE_ID.
    it("identifies the booking with custom_id and never invoice_id", async () => {
      await createPayPalOrder({
        amountUsd: 10,
        bookingId: "BOOKID1234",
        requestId: "r1",
      });

      expect(bodyOf(1).purchase_units[0].custom_id).toBe("BOOKID1234");
      expect(bodyOf(1).purchase_units[0].invoice_id).toBeUndefined();
    });

    // Without these PayPal collects a shipping address nothing reads, after
    // we already service-area gated a different one, and labels the button
    // "Continue" rather than "Pay Now".
    it("suppresses the address selector and asks for a pay-now button", async () => {
      await createPayPalOrder({
        amountUsd: 10,
        bookingId: "B1",
        requestId: "r1",
      });

      const context = bodyOf(1).payment_source.paypal.experience_context;
      expect(context.shipping_preference).toBe("NO_SHIPPING");
      expect(context.user_action).toBe("PAY_NOW");
    });

    it("passes the idempotency key through as PayPal-Request-Id", async () => {
      await createPayPalOrder({
        amountUsd: 10,
        bookingId: "B1",
        requestId: "B1:12345",
      });

      expect(headersOf(1)["PayPal-Request-Id"]).toBe("B1:12345");
      expect(bodyOf(1).intent).toBe("CAPTURE");
    });
  });

  describe("capturePayPalOrder", () => {
    it("POSTs to the capture endpoint with the order id escaped", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(jsonResponse({ id: "ORDER-1" }));

      await capturePayPalOrder("ORDER/1");

      expect(fetchMock.mock.calls[1][0]).toBe(
        `${PAYPAL_API_BASE}/v2/checkout/orders/ORDER%2F1/capture`,
      );
      expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    });

    // The route relies on `issue` to tell a retry apart from a real failure.
    it("surfaces ORDER_ALREADY_CAPTURED as the error's issue", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(
        jsonResponse(
          {
            name: "UNPROCESSABLE_ENTITY",
            debug_id: "dbg-3",
            details: [{ issue: ORDER_ALREADY_CAPTURED }],
          },
          422,
        ),
      );

      await expect(capturePayPalOrder("ORDER-1")).rejects.toMatchObject({
        issue: ORDER_ALREADY_CAPTURED,
        debugId: "dbg-3",
        status: 422,
      });
    });

    it("falls back to the top-level name when there are no details", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          jsonResponse({ name: "INSTRUMENT_DECLINED" }, 422),
        );

      await expect(capturePayPalOrder("ORDER-1")).rejects.toMatchObject({
        issue: "INSTRUMENT_DECLINED",
      });
    });

    // Error bodies can echo payer identifiers, which this app does not log.
    it("never puts the response body on the error", async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(
          jsonResponse(
            { name: "X", payer: { email: "buyer@example.com" } },
            500,
          ),
        );

      const error = await capturePayPalOrder("ORDER-1").catch((e) => e);
      expect(JSON.stringify(error)).not.toContain("buyer@example.com");
      expect(error.message).not.toContain("buyer@example.com");
    });

    it("survives a non-JSON error body", async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => {
          throw new SyntaxError("not json");
        },
      });

      await expect(capturePayPalOrder("ORDER-1")).rejects.toMatchObject({
        status: 504,
        issue: undefined,
      });
    });
  });

  describe("firstCapture", () => {
    it("reads the capture out of the first purchase unit", () => {
      expect(
        firstCapture({
          id: "O",
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAP1",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "10.00" },
                  },
                ],
              },
            },
          ],
        }),
      ).toMatchObject({ id: "CAP1" });
    });

    it.each([
      ["no purchase units", { id: "O", status: "CREATED" }],
      ["no payments", { id: "O", status: "CREATED", purchase_units: [{}] }],
      [
        "no captures",
        { id: "O", status: "CREATED", purchase_units: [{ payments: {} }] },
      ],
      [
        "an empty capture list",
        {
          id: "O",
          status: "CREATED",
          purchase_units: [{ payments: { captures: [] } }],
        },
      ],
    ])("returns null for %s", (_label, order) => {
      expect(firstCapture(order)).toBeNull();
    });
  });
});

describe("payPalErrorDetail", () => {
  it("carries the status, issue and debug id PayPal returned", () => {
    expect(
      payPalErrorDetail(
        new PayPalError("PayPal POST /v2/checkout/orders failed", {
          status: 422,
          issue: "AMOUNT_MISMATCH",
          debugId: "d3b07384d113edec",
        }),
      ),
    ).toEqual({
      status: 422,
      issue: "AMOUNT_MISMATCH",
      debugId: "d3b07384d113edec",
    });
  });

  // It is the log side of the rule the class itself keeps: a PayPal response
  // body can echo payer identifiers, so it is never carried anywhere.
  it("exposes no response body", () => {
    const error = new PayPalError("failed", { status: 400 });
    (error as unknown as { body: unknown }).body = {
      payer: { email_address: "buyer@example.com" },
    };

    expect(JSON.stringify(payPalErrorDetail(error))).not.toMatch(/buyer@/);
  });

  it.each([
    ["a plain Error", new Error("boom")],
    ["a thrown string", "boom"],
    ["undefined", undefined],
  ])("returns undefined for %s", (_label, thrown) => {
    expect(payPalErrorDetail(thrown)).toBeUndefined();
  });
});

describe("isPayPalAuthFailure", () => {
  it.each([
    [401, true],
    [403, true],
    [422, false],
    [500, false],
  ])("is %s → %s", (status, expected) => {
    expect(isPayPalAuthFailure(new PayPalError("x", { status }))).toBe(
      expected,
    );
  });

  it("is false for anything that is not a PayPalError", () => {
    expect(isPayPalAuthFailure(new Error("401"))).toBe(false);
  });
});

describe("warnOnClientIdMismatch", () => {
  const saved = {
    server: process.env.PAYPAL_CLIENT_ID,
    public: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
  };
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeEach(() => {
    resetPayPalClientIdWarning();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restore("PAYPAL_CLIENT_ID", saved.server);
    restore("NEXT_PUBLIC_PAYPAL_CLIENT_ID", saved.public);
  });

  it("reports lengths, never the ids themselves", () => {
    process.env.PAYPAL_CLIENT_ID = "eleven-char";
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "a-much-longer-client-id";

    warnOnClientIdMismatch();

    expect(console.error).toHaveBeenCalledWith("PAYPAL_CLIENT_ID_MISMATCH", {
      serverIdLength: 11,
      publicIdLength: 23,
    });
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toMatch(
      /eleven-char|longer-client-id/,
    );
  });

  it("warns once, not on every request", () => {
    process.env.PAYPAL_CLIENT_ID = "a";
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID = "bb";

    warnOnClientIdMismatch();
    warnOnClientIdMismatch();

    expect(console.error).toHaveBeenCalledTimes(1);
  });

  // A deployment that only supplies the public id at build time must not
  // start logging a mismatch it cannot act on.
  it.each([
    ["they agree", "same", "same"],
    ["the public id is absent", "only-server", undefined],
    ["the server id is absent", undefined, "only-public"],
  ])("stays quiet when %s", (_label, server, publicId) => {
    restore("PAYPAL_CLIENT_ID", server);
    restore("NEXT_PUBLIC_PAYPAL_CLIENT_ID", publicId);

    warnOnClientIdMismatch();

    expect(console.error).not.toHaveBeenCalled();
  });
});
