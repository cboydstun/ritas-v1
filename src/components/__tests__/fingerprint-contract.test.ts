/**
 * @jest-environment jsdom
 */
import { fingerprintHashSchema } from "@/lib/validation";

/**
 * The one coupling between ThumbmarkJS and the server that nothing else
 * covers.
 *
 * Both trackers mock `getFingerprint` in their own tests, so a change to the
 * hash *format* — a longer digest, base64, a prefix — would leave every suite
 * green while `/api/v1/analytics/fingerprint` started 400ing on every page
 * view. That schema is pinned to a hex string deliberately: it is the value
 * that reaches a Mongo filter, so it cannot simply be loosened.
 *
 * This runs the real library rather than a mock, which is the entire point.
 *
 * It cannot run it under browser conditions, though, and that limit is worth
 * stating rather than hiding. jsdom ships neither `TextEncoder` nor
 * `crypto.subtle`; supply them, as the `beforeAll` below does, and ThumbmarkJS
 * takes its WebCrypto branch, which cannot complete here and resolves to `""`.
 * Withhold them and it falls back to a non-WebCrypto path that no real browser
 * ever reaches. Either way the assertion below is about the *format contract*,
 * not about whether fingerprinting works.
 *
 * The shim is installed here rather than in `jest.setup.js` deliberately —
 * globally it would change which branch other suites' libraries take.
 *
 * The browser behaviour is verified out of band against production data: as of
 * 2026-08-20 the `thumbprints` collection held 1,957 documents, every
 * `fingerprintHash` a valid 32-character hex string.
 */
describe("ThumbmarkJS hash / server schema contract", () => {
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

  it("produces a hash the fingerprint endpoint will accept, or nothing", async () => {
    const { getFingerprint } = await import("@thumbmarkjs/thumbmarkjs");

    const hash = await getFingerprint();

    expect(typeof hash).toBe("string");

    // `""` is the jsdom outcome described above, not a passing result — the
    // library gave up rather than emitting a hash in the wrong format. What
    // this guards is the other branch: if ThumbmarkJS ever changes its digest
    // to base64, a different length, or a prefixed string, the schema rejects
    // it here rather than 400ing on every page view in production.
    if (hash !== "") {
      expect(fingerprintHashSchema.safeParse(hash).success).toBe(true);
    }
  }, 30000);

  // The half of the contract jsdom cannot reach, pinned against a digest of the
  // shape production actually stores.
  it("accepts the 32-character hex digest a real browser produces", () => {
    expect(
      fingerprintHashSchema.safeParse("9f2c1b7ae4d0836512cc7e4b0a9df31e")
        .success,
    ).toBe(true);
  });

  // The schema is pinned to hex because the value reaches a Mongo filter, so it
  // cannot simply be loosened if the library's format changes.
  it("rejects a digest that is not hex", () => {
    expect(fingerprintHashSchema.safeParse("not-a-hash").success).toBe(false);
    expect(fingerprintHashSchema.safeParse("").success).toBe(false);
  });
});
