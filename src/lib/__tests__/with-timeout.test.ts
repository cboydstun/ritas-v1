/**
 * @jest-environment node
 */
import {
  withTimeout,
  TimeoutError,
  NOTIFICATION_TIMEOUT_MS,
} from "@/lib/with-timeout";

describe("withTimeout", () => {
  it("resolves with the value when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "test")).resolves.toBe(
      "ok",
    );
  });

  it("propagates a rejection rather than masking it as a timeout", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 50, "test"),
    ).rejects.toThrow("boom");
  });

  it("rejects with a TimeoutError naming the provider and the bound", async () => {
    const never = new Promise(() => {});

    await expect(withTimeout(never, 10, "Twilio")).rejects.toThrow(
      new TimeoutError("Twilio", 10),
    );
    await expect(withTimeout(never, 10, "Twilio")).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Twilio did not respond within 10ms",
    });
  });

  it("clears its timer so a settled call cannot hold the event loop open", async () => {
    const clear = jest.spyOn(global, "clearTimeout");

    await withTimeout(Promise.resolve(1), 10_000, "test");

    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("bounds notifications at five seconds", () => {
    expect(NOTIFICATION_TIMEOUT_MS).toBe(5000);
  });
});
