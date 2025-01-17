export interface MixerOption {
  type: "none" | "kool-aid" | "margarita" | "pina-colada";
  label: string;
  description: string;
}

export interface MachinePackage {
  type: "single" | "double";
  capacity: 15 | 30;
  name: string;
  description: string;
  mixerOptions: {
    type: MixerOption["type"];
    price: number;
  }[];
  features: string[];
}

export const mixerDetails: Record<MixerOption["type"], MixerOption> = {
  none: {
    type: "none",
    label: "No Mixer",
    description: "Bring your own mixer for complete control over your drinks",
  },
  "kool-aid": {
    type: "kool-aid",
    label: "Kool-Aid Mixer",
    description: "Non-alcoholic, perfect for family events",
  },
  margarita: {
    type: "margarita",
    label: "Margarita Mixer",
    description: "Classic margarita mix, just add tequila",
  },
  "pina-colada": {
    type: "pina-colada",
    label: "Piña Colada Mixer",
    description: "Tropical piña colada mix, just add rum",
  },
};

export const machinePackages: MachinePackage[] = [
  {
    type: "single",
    capacity: 15,
    name: "15L Single Tank Machine",
    description: "Perfect for smaller gatherings and parties",
    mixerOptions: [
      { type: "none", price: 89.95 },
      { type: "kool-aid", price: 99.95 },
      { type: "margarita", price: 124.95 },
      { type: "pina-colada", price: 124.95 },
    ],
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
    mixerOptions: [
      { type: "none", price: 124.95 },
      { type: "kool-aid", price: 149.95 },
      { type: "margarita", price: 174.95 },
      { type: "pina-colada", price: 174.95 },
    ],
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
