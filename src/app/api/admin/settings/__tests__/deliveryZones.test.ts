/**
 * @jest-environment node
 */
import { GET, PATCH, PUT } from "../route";
import { Settings } from "@/models/settings";
import { getServerSession } from "next-auth";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/settings", () => ({
  Settings: Object.assign(jest.fn(), {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  }),
}));

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

type StoredDoc = {
  deliveryZones: {
    customFees: Map<string, number>;
    insideZips: string[];
    outsideZips: string[];
    tierMinimums: Record<string, number> | undefined;
    baseFee?: number;
  };
  updatedAt?: Date;
  updatedBy?: string;
  markModified: jest.Mock;
  save: jest.Mock;
  toObject: jest.Mock;
};

function storedDoc(
  overrides: Partial<StoredDoc["deliveryZones"]> = {},
): StoredDoc {
  const doc: StoredDoc = {
    deliveryZones: {
      customFees: new Map<string, number>([
        ["78209", 0],
        ["78006", 75],
      ]),
      insideZips: ["78209"],
      outsideZips: ["78006"],
      tierMinimums: { free: 100, low: 150, standard: 0, high: 0, premium: 0 },
      baseFee: 20,
      ...overrides,
    },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn(() => ({ ok: true })),
  };
  return doc;
}

const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { role: "admin", name: "Chris" },
  });
});

describe("GET serialises the fee map", () => {
  it("serves customFees as an object, not as an empty one", async () => {
    // The bug this pins shipped to production. `deliveryZones.customFees` is a
    // Mongoose `Map` and `JSON.stringify` renders a Map as `{}`, so the admin
    // page loaded an empty fee map and reported "0 serviced · 120 configured"
    // over a database where all 120 ZIPs were priced. Asserting the parsed
    // response body is the only place that difference is visible — asserting
    // what `toObject` returned would have passed either way.
    const fees = new Map<string, number>([
      ["78205", 0],
      ["78015", 75],
    ]);
    (Settings.findOne as jest.Mock).mockResolvedValue({
      toObject: (options?: { flattenMaps?: boolean }) => ({
        key: "global",
        deliveryZones: {
          customFees: options?.flattenMaps
            ? Object.fromEntries(fees)
            : (fees as unknown),
        },
      }),
    });

    const response = await GET();
    const body = await response.json();

    expect(body.deliveryZones.customFees).toEqual({ "78205": 0, "78015": 75 });
  });
});

describe("PATCH auth", () => {
  it.each([
    ["no session", null],
    ["a non-admin session", { user: { role: "user" } }],
  ])("refuses %s", async (_label, session) => {
    (getServerSession as jest.Mock).mockResolvedValue(session);
    const response = await patch({ removeCustomZipFee: "78006" });
    expect(response.status).toBe(401);
    expect(Settings.findOne).not.toHaveBeenCalled();
  });
});

describe("setCustomZipFee", () => {
  it("writes one ZIP and leaves every other fee alone", async () => {
    // The regression this verb exists for: resending the whole map reverted
    // every fee written since the admin page last loaded.
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    const response = await patch({
      setCustomZipFee: { zipCode: "78163", fee: 25 },
    });

    expect(response.status).toBe(200);
    expect(doc.deliveryZones.customFees.get("78163")).toBe(25);
    expect(doc.deliveryZones.customFees.get("78006")).toBe(75);
    expect(doc.deliveryZones.customFees.get("78209")).toBe(0);
    expect(doc.markModified).toHaveBeenCalledWith("deliveryZones.customFees");
    expect(doc.save).toHaveBeenCalled();
  });

  it("accepts a fee of 0, which is a price", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ setCustomZipFee: { zipCode: "78163", fee: 0 } });

    expect(doc.deliveryZones.customFees.get("78163")).toBe(0);
  });

  it.each([
    ["a non-5-digit ZIP", { setCustomZipFee: { zipCode: "782", fee: 25 } }],
    ["a negative fee", { setCustomZipFee: { zipCode: "78163", fee: -5 } }],
    ["a non-numeric fee", { setCustomZipFee: { zipCode: "78163", fee: "25" } }],
    ["an unknown verb", { setEverything: true }],
  ])("refuses %s", async (_label, body) => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("removeCustomZipFee", () => {
  it("deletes the key rather than writing 0", async () => {
    // Writing 0 would say "we deliver here for free", which is the opposite of
    // what removing a fee means.
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ removeCustomZipFee: "78006" });

    expect(doc.deliveryZones.customFees.has("78006")).toBe(false);
    expect(doc.deliveryZones.customFees.get("78209")).toBe(0);
  });
});

describe("updateZipLists", () => {
  it("assigns one list without clearing the other", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateZipLists: { insideZips: ["78209", "78210"] } });

    expect(doc.deliveryZones.insideZips).toEqual(["78209", "78210"]);
    expect(doc.deliveryZones.outsideZips).toEqual(["78006"]);
  });

  it("lets an admin empty a zone", async () => {
    // Membership is geography and grants no price, so an empty zone is a state
    // the admin is entitled to save.
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateZipLists: { insideZips: [] } });

    expect(doc.deliveryZones.insideZips).toEqual([]);
  });

  it("does not touch the fee map", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateZipLists: { insideZips: [] } });

    expect(doc.deliveryZones.customFees.size).toBe(2);
  });
});

describe("updateTierMinimums", () => {
  it("merges the band it was given and keeps the rest", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateTierMinimums: { high: 250 } });

    expect(doc.deliveryZones.tierMinimums).toEqual({
      free: 100,
      low: 150,
      standard: 0,
      high: 250,
      premium: 0,
    });
  });

  it("fills a document that has never carried a ladder", async () => {
    const doc = storedDoc({ tierMinimums: undefined });
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateTierMinimums: { high: 250 } });

    expect(doc.deliveryZones.tierMinimums).toEqual({
      free: 0,
      low: 0,
      standard: 0,
      high: 250,
      premium: 0,
    });
  });

  it("stores a band set back to 0", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateTierMinimums: { free: 0 } });

    expect(doc.deliveryZones.tierMinimums?.free).toBe(0);
  });

  it.each([
    ["an unknown band", { premiumm: 100 }],
    ["unserviced, which is not a band", { unserviced: 100 }],
    ["a negative floor", { high: -1 }],
  ])("refuses %s", async (_label, tiers) => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    const response = await patch({ updateTierMinimums: tiers });

    expect(response.status).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("updateBaseFee", () => {
  it("stores the flat fee every order pays", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateBaseFee: 30 });

    expect(doc.deliveryZones.baseFee).toBe(30);
    expect(doc.save).toHaveBeenCalled();
  });

  it("stores a base fee set to 0 rather than treating it as unset", async () => {
    // An admin who wants distance to be the only charge is entitled to say so,
    // and the next read must not re-default it back to $20.
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateBaseFee: 0 });

    expect(doc.deliveryZones.baseFee).toBe(0);
  });

  it("leaves every other slice of the document alone", async () => {
    // Each verb writes only its own field. `customFees` is the service area;
    // a verb that resent it would take ZIPs out of it.
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ updateBaseFee: 30 });

    expect(doc.deliveryZones.customFees.get("78006")).toBe(75);
    expect(doc.deliveryZones.insideZips).toEqual(["78209"]);
    expect(doc.deliveryZones.tierMinimums?.free).toBe(100);
  });

  it.each([
    ["a negative fee", -1],
    ["a non-number", "twenty"],
  ])("refuses %s", async (_label, baseFee) => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    const response = await patch({ updateBaseFee: baseFee });

    expect(response.status).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("audit", () => {
  it("records who wrote the change", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ removeCustomZipFee: "78006" });

    expect(doc.updatedBy).toBe("Chris");
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });
});

describe("PUT serialises the fee map", () => {
  const put = (body: unknown) =>
    PUT(
      new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  it("echoes customFees as an object, not as an empty one", async () => {
    // The same gap #14 closed on GET, left open on this verb. Nothing reads
    // this body today — the zone admin writes through PATCH — which is exactly
    // the reason the GET shipped broken: an unread response is not a checked
    // one.
    const fees = new Map<string, number>([["78205", 0]]);
    (Settings.findOneAndUpdate as jest.Mock).mockResolvedValue({
      toObject: (options?: { flattenMaps?: boolean }) => ({
        key: "global",
        deliveryZones: {
          customFees: options?.flattenMaps
            ? Object.fromEntries(fees)
            : (fees as unknown),
        },
      }),
    });

    const body = await (await put({ fees: { deliveryFee: 30 } })).json();

    expect(body.deliveryZones.customFees).toEqual({ "78205": 0 });
  });

  it("accepts a minimum order amount", async () => {
    // `minimumForZip` has always documented `fees.minOrderAmount` as the
    // fallback for a ZIP whose band carries no floor, and three call sites
    // pass it — but it was absent from `settingsUpdateSchema.fees`, so Zod
    // stripped it from every body and no PATCH verb or admin field covered it
    // either. The documented fallback could not be set from anywhere.
    (Settings.findOneAndUpdate as jest.Mock).mockResolvedValue({
      toObject: () => ({ key: "global", fees: { minOrderAmount: 125 } }),
    });

    const response = await put({ fees: { minOrderAmount: 125 } });

    expect(response.status).toBe(200);
    // `fees` is written as a subtree by this verb, so the assertion is on the
    // field surviving Zod rather than on a dotted path.
    const [, update] = (Settings.findOneAndUpdate as jest.Mock).mock.calls[0];
    expect(update.fees).toEqual({ minOrderAmount: 125 });
  });

  it("refuses a negative minimum order amount", async () => {
    const response = await put({ fees: { minOrderAmount: -1 } });

    expect(response.status).toBe(400);
    expect(Settings.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
