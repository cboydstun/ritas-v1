/**
 * Bound how long a notification call may hold up a response.
 *
 * Twilio and Resend are both awaited inline after the booking has already been
 * committed. Their failures are caught and logged rather than rolled back,
 * which is right — but neither call had any time bound, so a hung provider
 * held the function to the platform timeout and the customer got a 504 for a
 * booking that had actually succeeded.
 *
 * This does not cancel the underlying request (neither SDK exposes a signal),
 * it just stops the caller waiting on it. For a fire-and-log notification that
 * is the behaviour we want.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} did not respond within ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** Notifications are not worth more than a few seconds of a customer's wait. */
export const NOTIFICATION_TIMEOUT_MS = 5000;
