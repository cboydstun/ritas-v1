/**
 * @jest-environment node
 */
import { PATCH } from "../route";
import { Settings } from "@/models/settings";
import { getServerSession } from "next-auth";

jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/settings", () => ({
  Settings: Object.assign(jest.fn(), { findOne: jest.fn() }),
}));

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

type StoredDoc = {
  deliveryZones: {
    customFees: Map<string, number>;
    insideZips: string[];
    outsideZips: string[];
    tierMinimums: Record<string, number> | undefined;
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

describe("audit", () => {
  it("records who wrote the change", async () => {
    const doc = storedDoc();
    (Settings.findOne as jest.Mock).mockResolvedValue(doc);

    await patch({ removeCustomZipFee: "78006" });

    expect(doc.updatedBy).toBe("Chris");
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });
});
