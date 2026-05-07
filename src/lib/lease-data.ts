export type LeaseTierId = "single-15" | "double-30" | "triple-45";

export interface LeaseTier {
  id: LeaseTierId;
  name: string;
  capacity: 15 | 30 | 45;
  image: string;
  monthlyRate: number;
  placementFee: number;
  minimumTermMonths: number;
  bestFor: string;
  features: string[];
  electrical: string;
  spaceRequirements: string;
}

// Monthly rates, placement fees, and electrical/space specs are placeholders
// pending business owner confirmation before launch.
export const leaseTiers: LeaseTier[] = [
  {
    id: "single-15",
    name: "15L Single Tank",
    capacity: 15,
    image: "/vevor-15l-slushy-3.webp",
    monthlyRate: 265,
    placementFee: 100,
    minimumTermMonths: 12,
    bestFor:
      "Smaller restaurants, daiquiri kiosks, and lower-volume bar programs.",
    features: [
      "15L single-tank capacity",
      "One signature flavor on tap",
      "Professional placement & install",
      "Quarterly preventive maintenance",
      "Mixer supply program available",
      "Custom branding option",
    ],
    electrical: "Standard 110V, 15A circuit",
    spaceRequirements: '24" x 24" countertop, 18" overhead clearance',
  },
  {
    id: "double-30",
    name: "30L Double Tank",
    capacity: 30,
    image: "/vevor-30l-slushy-4.webp",
    monthlyRate: 295,
    placementFee: 100,
    minimumTermMonths: 12,
    bestFor:
      "Mexican restaurants, sports bars, and venues serving two flavors at moderate volume.",
    features: [
      "30L dual-tank capacity",
      "Two flavors on tap simultaneously",
      "Professional placement & install",
      "Quarterly preventive maintenance",
      "Mixer supply program available",
      "Custom branding option",
    ],
    electrical: "Dedicated 115V, 20A circuit",
    spaceRequirements: '30" x 24" countertop, 18" overhead clearance',
  },
  {
    id: "triple-45",
    name: "45L Triple Tank",
    capacity: 45,
    image: "/vevor-45l-slushy-1.webp",
    monthlyRate: 335,
    placementFee: 100,
    minimumTermMonths: 12,
    bestFor:
      "Hotel resorts, golf courses, drive-thru daiquiri shops, and high-volume venues.",
    features: [
      "45L triple-tank capacity",
      "Three flavors on tap simultaneously",
      "Professional placement & install",
      "Quarterly preventive maintenance",
      "Priority on-site service",
      "Mixer supply program available",
      "Custom branding option",
    ],
    electrical: "Dedicated 115V, 20A circuit",
    spaceRequirements: '36" x 24" countertop, 18" overhead clearance',
  },
];

export type LeaseTierOverride = Partial<
  Pick<
    LeaseTier,
    | "monthlyRate"
    | "placementFee"
    | "minimumTermMonths"
    | "bestFor"
    | "features"
    | "electrical"
    | "spaceRequirements"
  >
>;

export function mergeLeaseTiers(
  overrides?: Partial<Record<LeaseTierId, LeaseTierOverride>> | null,
): LeaseTier[] {
  if (!overrides) return leaseTiers;
  return leaseTiers.map((t) => ({ ...t, ...(overrides[t.id] ?? {}) }));
}

export const LEASE_BUSINESS_TYPES = [
  "Restaurant",
  "Golf Course",
  "Hotel/Resort",
  "Sports Bar",
  "Drive-Thru Daiquiri",
  "Other",
] as const;

export type LeaseBusinessType = (typeof LEASE_BUSINESS_TYPES)[number];

export const LEASE_TERMS = ["Month-to-month", "12-month", "Other"] as const;

export type LeaseTerm = (typeof LEASE_TERMS)[number];
