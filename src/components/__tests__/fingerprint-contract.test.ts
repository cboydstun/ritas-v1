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
 */
describe("ThumbmarkJS hash / server schema contract", () => {
  it("produces a hash the fingerprint endpoint will accept", async () => {
    const { getFingerprint } = await import("@thumbmarkjs/thumbmarkjs");

    const hash = await getFingerprint();

    expect(typeof hash).toBe("string");
    expect(fingerprintHashSchema.safeParse(hash).success).toBe(true);
  }, 30000);
});
