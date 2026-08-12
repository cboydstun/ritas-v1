/**
 * Log-safe summary of a thrown value.
 *
 * Routes used to log `error.message` and `error.stack` wholesale. Mongoose
 * `ValidationError` and MongoServerError duplicate-key messages embed the
 * *offending values* — customer name, email, phone, street address — and
 * `next.config.ts` deliberately preserves `console.error` in production
 * builds, so those landed verbatim in the runtime logs. The response bodies
 * were already generic; this closes the log sink.
 *
 * Field paths are kept because they are what makes a validation failure
 * diagnosable, and they are schema names rather than customer data.
 */
export interface SafeErrorSummary {
  name: string;
  fields?: string[];
  code?: string | number;
}

export function safeErrorSummary(error: unknown): SafeErrorSummary {
  if (!(error instanceof Error)) {
    return { name: typeof error };
  }

  const summary: SafeErrorSummary = { name: error.name };

  // Mongoose ValidationError: `errors` is keyed by the failing path.
  const errors = (error as { errors?: Record<string, unknown> }).errors;
  if (errors && typeof errors === "object") {
    summary.fields = Object.keys(errors);
  }

  // MongoServerError carries a numeric code (11000 is a duplicate key); the
  // code alone is diagnostic and the message that would name the value is not.
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") {
    summary.code = code;
  }

  return summary;
}
