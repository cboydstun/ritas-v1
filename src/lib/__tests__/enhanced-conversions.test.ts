import { hashUserData } from "../enhanced-conversions";
import { setConsent } from "../consent";

// jsdom omits both `TextEncoder` and `crypto.subtle`; every browser has both,
// so without them `hashUserData` permanently takes its degraded path and this
// whole file would pass while asserting nothing. Node's WebCrypto is the same
// implementation a browser exposes.
//
// Deliberately local to this file rather than in `jest.setup.js`. Installing
// them globally changes which code path *other* libraries take under test —
// ThumbmarkJS switches to its WebCrypto branch, which cannot complete in jsdom
// and returns an empty string, breaking `fingerprint-contract.test.ts`.
beforeAll(() => {
  const { TextEncoder, TextDecoder } = jest.requireActual("node:util");
  const { webcrypto } = jest.requireActual("node:crypto");
  if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
  if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
  if (globalThis.crypto && !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis.crypto, "subtle", {
      value: webcrypto.subtle,
      configurable: true,
    });
  }
});

// Reference digests, computed independently with node:crypto over the exact
// normalised strings Google specifies. They are literals rather than something
// this test derives, because a helper that normalised the expectation the same
// way the implementation does would pass whatever either of them did — and
// normalisation is the entire risk here. Google hashes its own copy and
// compares digests, so one stray capital letter is not a weaker match, it is
// no match at all, and nothing anywhere reports it.
const SHA256_EMAIL =
  "cd25a6171969f2a3c6e35c7667e3908ef1bd2424241db04411a0eec454ca6c16"; // sam@example.com
const SHA256_PHONE =
  "1aba3806cccb29d6e870800897bd3f4a57d1d8af39ce94fae61e1ff7e9424980"; // +12105550134

describe("hashUserData", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("hashes email and phone into the keys Google Ads expects", async () => {
    const result = await hashUserData({
      email: "sam@example.com",
      phone: "210-555-0134",
    });

    expect(Object.keys(result ?? {}).sort()).toEqual([
      "sha256_email_address",
      "sha256_phone_number",
    ]);
    expect(result?.sha256_email_address).toBe(SHA256_EMAIL);
    expect(result?.sha256_phone_number).toBe(SHA256_PHONE);
  });

  // Google normalises its own copy to lowercase and trims it. If this app did
  // not, the two digests would differ and the conversion would simply never
  // match — with no error to notice.
  it("normalises email case and surrounding whitespace before hashing", async () => {
    const plain = await hashUserData({ email: "sam@example.com" });
    const messy = await hashUserData({ email: "  SAM@Example.COM  " });

    expect(plain?.sha256_email_address).toBe(SHA256_EMAIL);
    expect(messy?.sha256_email_address).toBe(SHA256_EMAIL);
  });

  // E.164 is the required format, so every US formatting of one number has to
  // collapse to a single digest.
  it("normalises every US phone formatting to the same E.164 digest", async () => {
    const digests = await Promise.all(
      ["210-555-0134", "(210) 555-0134", "2105550134", "+1 210 555 0134"].map(
        async (phone) => (await hashUserData({ phone }))?.sha256_phone_number,
      ),
    );

    expect(new Set(digests).size).toBe(1);
    expect(digests[0]).toBe(SHA256_PHONE);
  });

  it("omits a phone number that is not a plausible US number", async () => {
    const result = await hashUserData({
      email: "sam@example.com",
      phone: "555",
    });

    expect(result?.sha256_phone_number).toBeUndefined();
    expect(result?.sha256_email_address).toBeDefined();
  });

  it("returns undefined when there is nothing to hash", async () => {
    await expect(hashUserData({})).resolves.toBeUndefined();
    await expect(hashUserData({ email: "   " })).resolves.toBeUndefined();
  });

  // The banner promises the opt-out is honoured. Consent Mode would suppress
  // the tag anyway, but not producing the digest at all is the honest version.
  it("returns undefined when the visitor has opted out", async () => {
    setConsent("denied");

    await expect(
      hashUserData({ email: "sam@example.com", phone: "210-555-0134" }),
    ).resolves.toBeUndefined();
  });

  it("still hashes when the visitor has opted in", async () => {
    setConsent("granted");

    const result = await hashUserData({ email: "sam@example.com" });
    expect(result?.sha256_email_address).toBe(SHA256_EMAIL);
  });

  // Called from the booking submit handler *after* the booking is written, and
  // inside a try whose catch tells the customer their booking failed. On an
  // insecure origin `crypto.subtle` is simply absent, so this must degrade,
  // never throw.
  it("returns undefined instead of throwing when SubtleCrypto is unavailable", async () => {
    const subtle = crypto.subtle;
    Object.defineProperty(crypto, "subtle", {
      value: undefined,
      configurable: true,
    });

    await expect(
      hashUserData({ email: "sam@example.com" }),
    ).resolves.toBeUndefined();

    Object.defineProperty(crypto, "subtle", {
      value: subtle,
      configurable: true,
    });
  });
});
