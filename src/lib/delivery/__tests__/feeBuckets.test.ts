import {
  FEE_BUCKETS,
  FEE_BUCKET_ORDER,
  bucketForFee,
} from "@/lib/delivery/feeBuckets";

describe("bucketForFee", () => {
  it("reads an absent fee as unserviced, never as free", () => {
    // The whole point of the `null` fee: nobody priced this ZIP. Painting it
    // green would advertise free delivery to an address we do not serve.
    expect(bucketForFee(null).id).toBe("unserviced");
    expect(bucketForFee(undefined).id).toBe("unserviced");
    expect(bucketForFee(Number.NaN).id).toBe("unserviced");
  });

  it("reads a configured $0 as free", () => {
    expect(bucketForFee(0).id).toBe("free");
  });

  it("puts each band edge in the lower band", () => {
    expect(bucketForFee(0.01).id).toBe("low");
    expect(bucketForFee(25).id).toBe("low");
    expect(bucketForFee(25.01).id).toBe("standard");
    expect(bucketForFee(50).id).toBe("standard");
    expect(bucketForFee(50.01).id).toBe("high");
    expect(bucketForFee(100).id).toBe("high");
    expect(bucketForFee(100.01).id).toBe("premium");
  });

  it("treats a negative fee as free rather than falling through", () => {
    expect(bucketForFee(-5).id).toBe("free");
  });
});

describe("FEE_BUCKETS", () => {
  it("lists every bucket in the legend exactly once", () => {
    expect(FEE_BUCKET_ORDER).toHaveLength(Object.keys(FEE_BUCKETS).length);
    expect(new Set(FEE_BUCKET_ORDER).size).toBe(FEE_BUCKET_ORDER.length);
  });

  it("gives every bucket a fill and a stroke", () => {
    for (const id of FEE_BUCKET_ORDER) {
      const bucket = FEE_BUCKETS[id];
      expect(bucket.fill).toMatch(/^#[0-9A-F]{6}$/i);
      expect(bucket.stroke).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("gives every bucket a distinct fill", () => {
    // Two bands sharing a colour means two different prices read alike on the
    // map, which is the one thing the map exists to prevent.
    const fills = FEE_BUCKET_ORDER.map((id) => FEE_BUCKETS[id].fill);
    expect(new Set(fills).size).toBe(fills.length);
  });
});
