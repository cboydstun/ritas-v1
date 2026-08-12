/**
 * @jest-environment node
 */
import { safeErrorSummary } from "@/lib/safe-error";

// Routes used to log error.message and error.stack wholesale. Mongoose
// validation and duplicate-key messages embed the offending customer values,
// and production builds keep console.error, so those reached the runtime logs.
describe("safeErrorSummary", () => {
  it("keeps only the error name for a plain Error", () => {
    expect(
      safeErrorSummary(new Error("customer bob@example.com is invalid")),
    ).toEqual({ name: "Error" });
  });

  it("reports the schema paths of a Mongoose-shaped ValidationError", () => {
    const error = Object.assign(new Error("Rental validation failed"), {
      name: "ValidationError",
      errors: {
        "customer.email": { message: "bad email: bob@example.com" },
        "customer.phone": { message: "bad phone: 2105551234" },
      },
    });

    expect(safeErrorSummary(error)).toEqual({
      name: "ValidationError",
      fields: ["customer.email", "customer.phone"],
    });
  });

  it("keeps a driver code without the message that names the value", () => {
    const error = Object.assign(
      new Error('E11000 duplicate key: { email: "bob@example.com" }'),
      { name: "MongoServerError", code: 11000 },
    );

    expect(safeErrorSummary(error)).toEqual({
      name: "MongoServerError",
      code: 11000,
    });
  });

  it("never returns a message or stack field", () => {
    const summary = safeErrorSummary(new Error("secret"));

    expect(summary).not.toHaveProperty("message");
    expect(summary).not.toHaveProperty("stack");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  it("describes a non-Error throw by its type", () => {
    expect(safeErrorSummary("boom")).toEqual({ name: "string" });
    expect(safeErrorSummary(null)).toEqual({ name: "object" });
  });
});
