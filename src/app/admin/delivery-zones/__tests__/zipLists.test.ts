import {
  listedZips,
  nextZone,
  setZipZone,
  unpricedListedZips,
  zipInventory,
  zipListsFromSettings,
  zoneOf,
  type ZipLists,
} from "../zipLists";

const lists: ZipLists = { inside: ["78209", "78210"], outside: ["78006"] };
const rows = [
  { zipCode: "78209", fee: 0 },
  { zipCode: "78210", fee: null },
  { zipCode: "78006", fee: 75 },
  { zipCode: "78163", fee: 20 },
  { zipCode: "78999", fee: null },
];

describe("zipListsFromSettings", () => {
  it("returns null until both lists have loaded", () => {
    // Serialising "not loaded" as [] tells the server the admin emptied the
    // list, and the server obliges.
    expect(zipListsFromSettings(undefined)).toBeNull();
    expect(zipListsFromSettings({})).toBeNull();
    expect(zipListsFromSettings({ insideZips: [] })).toBeNull();
  });

  it("accepts two empty lists as loaded", () => {
    expect(zipListsFromSettings({ insideZips: [], outsideZips: [] })).toEqual({
      inside: [],
      outside: [],
    });
  });
});

describe("zoneOf and nextZone", () => {
  it("reports the list a ZIP is on, or null for neither", () => {
    expect(zoneOf(lists, "78209")).toBe("inside");
    expect(zoneOf(lists, "78006")).toBe("outside");
    expect(zoneOf(lists, "78163")).toBeNull();
  });

  it("cycles inside → outside → none → inside", () => {
    expect(nextZone("inside")).toBe("outside");
    expect(nextZone("outside")).toBeNull();
    expect(nextZone(null)).toBe("inside");
  });
});

describe("setZipZone", () => {
  it("moves a ZIP between lists without duplicating it", () => {
    const moved = setZipZone(lists, "78209", "outside");
    expect(moved.inside).toEqual(["78210"]);
    expect(moved.outside).toEqual(["78006", "78209"]);
  });

  it("adds a ZIP that was on neither list", () => {
    expect(setZipZone(lists, "78163", "inside").inside).toContain("78163");
  });

  it("clears a ZIP to neither list", () => {
    const cleared = setZipZone(lists, "78209", null);
    expect(cleared.inside).toEqual(["78210"]);
    expect(cleared.outside).toEqual(["78006"]);
  });

  it("returns the same reference when the zone is unchanged", () => {
    // The badge cycles through ZIPs already on screen; without this a stray
    // click moves the ZIP to the end of its own list and repaints the panel.
    expect(setZipZone(lists, "78209", "inside")).toBe(lists);
  });

  it("never mutates its input", () => {
    const before = JSON.parse(JSON.stringify(lists));
    setZipZone(lists, "78209", "outside");
    expect(lists).toEqual(before);
  });
});

describe("zipInventory", () => {
  it("lists every configured ZIP once, ascending, with its zone", () => {
    expect(zipInventory(rows, lists)).toEqual([
      { zipCode: "78006", fee: 75, zone: "outside" },
      { zipCode: "78163", fee: 20, zone: null },
      { zipCode: "78209", fee: 0, zone: "inside" },
      { zipCode: "78210", fee: null, zone: "inside" },
    ]);
  });

  it("keeps a priced ZIP that is on neither list", () => {
    expect(zipInventory(rows, lists).map((r) => r.zipCode)).toContain("78163");
  });

  it("keeps a listed ZIP with no fee, because that is the warned-about state", () => {
    expect(zipInventory(rows, lists).map((r) => r.zipCode)).toContain("78210");
  });

  it("drops a ZIP that is neither priced nor listed", () => {
    expect(zipInventory(rows, lists).map((r) => r.zipCode)).not.toContain(
      "78999",
    );
  });

  it("still lists priced ZIPs before the zone lists have loaded", () => {
    expect(zipInventory(rows, null).map((r) => r.zipCode)).toEqual([
      "78006",
      "78163",
      "78209",
    ]);
  });
});

describe("unpricedListedZips", () => {
  it("flags a listed ZIP with no fee", () => {
    expect(
      unpricedListedZips(rows, listedZips(lists)).map((r) => r.zipCode),
    ).toEqual(["78210"]);
  });

  it("does not flag a ZIP priced at zero", () => {
    // $0 is a real price. Most of the close-in ZIPs may end up costing exactly
    // that, and flagging them would make the warning meaningless.
    expect(
      unpricedListedZips(rows, listedZips(lists)).map((r) => r.zipCode),
    ).not.toContain("78209");
  });

  it("ignores an unpriced ZIP that no list claims", () => {
    expect(
      unpricedListedZips(rows, listedZips(lists)).map((r) => r.zipCode),
    ).not.toContain("78999");
  });

  it("flags nothing before the lists have loaded", () => {
    expect(unpricedListedZips(rows, listedZips(null))).toEqual([]);
  });
});
