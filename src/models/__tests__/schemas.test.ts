/**
 * @jest-environment node
 *
 * Exercises the real schemas — no mocks, no database.
 *
 * `doc.validate()` runs schema validators and `pre("validate")` middleware
 * without a connection, so these cover the parts of the models that every
 * route depends on and that nothing else tested. Written during the mongoose 9
 * upgrade, which changed the middleware signature: hooks no longer receive a
 * `next` callback and signal failure by throwing.
 */
import { Rental } from "@/models/rental";
import { Settings } from "@/models/settings";
import { Contact } from "@/models/contact";
import { LeaseInquiry } from "@/models/leaseInquiry";
import { BlogPost } from "@/models/blogPost";

const validRental = (overrides: Record<string, unknown> = {}) => ({
  machineType: "double",
  capacity: 30,
  selectedMixers: ["margarita"],
  selectedExtras: [],
  price: 199.99,
  rentalDate: "2026-09-01",
  rentalTime: "12:00",
  returnDate: "2026-09-02",
  returnTime: "12:00",
  customer: {
    name: "Sam Rivera",
    email: "sam@example.com",
    phone: "210-555-0134",
    address: {
      street: "1 Alamo Plaza",
      city: "San Antonio",
      state: "TX",
      zipCode: "78205",
    },
  },
  status: "pending_payment",
  ...overrides,
});

describe("Rental schema", () => {
  it("accepts a well-formed booking", async () => {
    await expect(new Rental(validRental()).validate()).resolves.toBeUndefined();
  });

  // The pairing is derived server-side everywhere; this is the last line of
  // defence if a route ever stops deriving it.
  it("rejects a capacity that does not match the machine type", async () => {
    await expect(
      new Rental(
        validRental({ machineType: "double", capacity: 45 }),
      ).validate(),
    ).rejects.toThrow(/Capacity does not match/);
  });

  it.each([
    ["single", 15],
    ["double", 30],
    ["triple", 45],
  ])("accepts the %s / %i pairing", async (machineType, capacity) => {
    await expect(
      new Rental(validRental({ machineType, capacity })).validate(),
    ).resolves.toBeUndefined();
  });

  it("rejects an unknown machine type", async () => {
    await expect(
      new Rental(validRental({ machineType: "quadruple" })).validate(),
    ).rejects.toThrow();
  });

  it("requires a customer email", async () => {
    const rental = validRental() as { customer: { email?: string } };
    delete rental.customer.email;

    await expect(new Rental(rental).validate()).rejects.toThrow();
  });
});

describe("Settings schema", () => {
  // A pre("validate") hook, which is the middleware whose signature mongoose 9
  // changed. If it silently stopped running, this is what catches it.
  it("rejects a delivery window that ends before it starts", async () => {
    const settings = new Settings({
      key: "global",
      operations: { deliveryWindowStartHour: 18, deliveryWindowEndHour: 8 },
    });

    await expect(settings.validate()).rejects.toThrow(
      /deliveryWindowEndHour must be greater than deliveryWindowStartHour/,
    );
  });

  it("rejects a delivery window whose ends are equal", async () => {
    const settings = new Settings({
      key: "global",
      operations: { deliveryWindowStartHour: 10, deliveryWindowEndHour: 10 },
    });

    await expect(settings.validate()).rejects.toThrow();
  });

  it("accepts a window that ends after it starts", async () => {
    const settings = new Settings({
      key: "global",
      operations: { deliveryWindowStartHour: 8, deliveryWindowEndHour: 18 },
    });

    await expect(settings.validate()).resolves.toBeUndefined();
  });

  // `getPublicSettings` relies on this: with no stored document it returns a
  // non-persisted instance so callers always see the schema defaults.
  it("supplies fee and inventory defaults with no document stored", () => {
    const doc = new Settings({}).toObject();

    expect(doc.fees.deliveryFee).toBeGreaterThan(0);
    expect(doc.fees.salesTaxRate).toBeGreaterThan(0);
    expect(doc.machines.single.inventory).toBeGreaterThan(0);
  });
});

describe("Contact and LeaseInquiry schemas", () => {
  it("accepts a well-formed contact", async () => {
    await expect(
      new Contact({
        name: "Sam Rivera",
        email: "sam@example.com",
        phone: "210-555-0134",
        eventDate: "next Saturday",
        message: "Do you deliver to Helotes?",
      }).validate(),
    ).resolves.toBeUndefined();
  });

  it("rejects a contact with no message", async () => {
    await expect(
      new Contact({
        name: "Sam Rivera",
        email: "sam@example.com",
        phone: "210-555-0134",
        eventDate: "next Saturday",
      }).validate(),
    ).rejects.toThrow();
  });

  it("rejects a lease inquiry with an unknown business type", async () => {
    await expect(
      new LeaseInquiry({
        businessName: "Bar Nowhere",
        businessType: "spaceport",
        contactName: "Sam Rivera",
        email: "sam@example.com",
        phone: "210-555-0134",
        address: {
          street: "1 Alamo Plaza",
          city: "San Antonio",
          state: "TX",
          zip: "78205",
        },
        preferredTerm: "12-months",
      }).validate(),
    ).rejects.toThrow();
  });
});

const validPost = (overrides: Record<string, unknown> = {}) => ({
  slug: "frozen-margarita-machine-rental",
  title: "Frozen Margarita Machine Rental",
  body: "<p>How delivery works.</p>",
  status: "draft",
  ...overrides,
});

describe("BlogPost schema", () => {
  it("accepts a well-formed draft", async () => {
    await expect(new BlogPost(validPost()).validate()).resolves.toBeUndefined();
  });

  it("requires a title", async () => {
    const post = validPost() as { title?: string };
    delete post.title;

    await expect(new BlogPost(post).validate()).rejects.toThrow();
  });

  it("requires a body", async () => {
    const post = validPost() as { body?: string };
    delete post.body;

    await expect(new BlogPost(post).validate()).rejects.toThrow();
  });

  it.each(["Not A Slug", "trailing-", "double--hyphen", "has space"])(
    "rejects the slug %s",
    async (slug) => {
      await expect(
        new BlogPost(validPost({ slug })).validate(),
      ).rejects.toThrow(/lowercase words/);
    },
  );

  it("rejects an unknown status", async () => {
    await expect(
      new BlogPost(validPost({ status: "archived" })).validate(),
    ).rejects.toThrow();
  });

  it("defaults a new post to draft", () => {
    const post = validPost() as { status?: string };
    delete post.status;

    expect(new BlogPost(post).status).toBe("draft");
  });

  // A pre("save") hook, which is the middleware whose signature mongoose 9
  // changed. `validate()` does not run save hooks, so this exercises it
  // through save() with the write stubbed out.
  it("refuses to save a published post with no publishedAt", async () => {
    const post = new BlogPost(validPost({ status: "published" }));

    await expect(post.validate()).resolves.toBeUndefined();
    await expect(post.save({ validateBeforeSave: false })).rejects.toThrow(
      /publishedAt/,
    );
  });
});
