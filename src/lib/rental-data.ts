export type MixerType =
  | "non-alcoholic"
  | "margarita"
  | "pina-colada"
  | "strawberry-daiquiri";

export interface MixerDetails {
  label: string;
  description: string;
  price: number;
}

export interface MachinePackage {
  type: "single" | "double";
  capacity: 15 | 30;
  name: string;
  description: string;
  basePrice: number;
  maxMixers: number;
  features: string[];
}

export const mixerDetails: Record<MixerType, MixerDetails> = {
  "non-alcoholic": {
    label: "Non-Alcoholic Mixer",
    description: "Non-alcoholic, perfect for family events",
    price: 14.95,
  },
  margarita: {
    label: "Margarita Mixer",
    description: "Classic margarita mix, just add tequila",
    price: 19.95,
  },
  "pina-colada": {
    label: "Piña Colada Mixer",
    description: "Tropical piña colada mix, just add rum",
    price: 24.95,
  },
  "strawberry-daiquiri": {
    label: "Strawberry Daiquiri Mixer",
    description: "Sweet strawberry daiquiri mix, just add rum",
    price: 24.95,
  },
};

export const machinePackages: MachinePackage[] = [
  {
    type: "single",
    capacity: 15,
    name: "15L Single Tank Machine",
    description: "Perfect for smaller gatherings and parties",
    basePrice: 89.95,
    maxMixers: 1,
    features: [
      "15L Capacity",
      "Single Tank System",
      "Easy to Use Controls",
      "Professional Setup & Training",
      "Cleaning Included",
      "24/7 Support",
    ],
  },
  {
    type: "double",
    capacity: 30,
    name: "30L Double Tank Machine",
    description: "Ideal for larger events and multiple flavors",
    basePrice: 124.95,
    maxMixers: 2,
    features: [
      "30L Total Capacity",
      "Dual Tank System",
      "Two Different Flavors",
      "Professional Setup & Training",
      "Cleaning Included",
      "24/7 Support",
      "Temperature Control",
    ],
  },
];
