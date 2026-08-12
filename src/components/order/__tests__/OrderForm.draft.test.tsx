import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
// NOTE: `jest` is used as a global here on purpose. Importing it from
// `@jest/globals` defeats SWC's jest.mock hoisting, so the real
// `next/navigation` loads first and `useSearchParams()` returns null.
import OrderForm from "../OrderForm";
import { todayLocalIso } from "@/lib/dates";

// Mutable so a test can drive the `?machine=` param. The `mock` prefix is what
// lets jest.mock's factory close over it despite the factory being hoisted;
// the factory only runs when next/navigation is first required, by which point
// this binding is initialised.
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// Keeps ThumbmarkJS (canvas/audio fingerprinting) out of jsdom — it is not
// what these tests are about and it throws noisily here.
jest.mock("../OrderFormTracker", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

const DRAFT_KEY = "satx-ritas-order-draft";
/** Must track `DRAFT_VERSION` in OrderForm.tsx — a mismatch discards the draft. */
const DRAFT_VERSION = 1;

/** A draft far enough in the future that it is never stale. */
const futureDate = (days: number): string => {
  const d = new Date(`${todayLocalIso()}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const writeDraft = (
  formData: Record<string, unknown>,
  step: string = "review",
) => {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      version: DRAFT_VERSION,
      formData: {
        machineType: "double",
        capacity: 30,
        selectedMixers: [],
        selectedExtras: [],
        price: 0,
        rentalDate: futureDate(7),
        rentalTime: "ANY",
        returnDate: futureDate(8),
        returnTime: "ANY",
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
        notes: "",
        isServiceDiscount: false,
        ...formData,
      },
      step,
    }),
  );
};

/** The step counter renders across several text nodes. */
const stepCounter = async (index: number) =>
  screen.findByText(
    (_text, node) =>
      node?.tagName === "SPAN" && node.textContent === `Step ${index} of 5`,
  );

/** What the draft looks like after OrderForm has rewritten it. */
const readDraft = () =>
  JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as {
    formData?: { selectedExtras?: { id: string }[]; selectedMixers?: string[] };
  };

describe("OrderForm draft restore", () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    localStorage.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;
  });

  it("falls back to the first step when the draft names a step that no longer exists", async () => {
    writeDraft({}, "confirm-payment");

    render(<OrderForm />);

    // The crash this guards against was `steps[-1].label` throwing during
    // ProgressBar's render, taking the whole order page down.
    expect(await stepCounter(1)).toBeInTheDocument();
  });

  it("discards a draft written before the version field existed", async () => {
    // The pre-version shape restored `machineType` and the two selection
    // arrays with no checking, which is what made an unknown value fatal.
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        formData: { customer: { name: "Sam Rivera" }, machineType: "quad" },
        step: "review",
      }),
    );

    render(<OrderForm />);

    expect(await stepCounter(1)).toBeInTheDocument();
  });

  it("survives a draft naming a machine type that no longer exists", async () => {
    // `calculatePrice` throws rather than defaulting on an unknown type, and
    // it runs in the useState initialiser and in PricingSummary's render — so
    // this used to hit the error boundary, and "Try again" re-read the same
    // draft. Unrecoverable without clearing localStorage by hand.
    writeDraft({ machineType: "quad", capacity: 99 });

    render(<OrderForm />);

    // Renders at all — the point of the test. The draft is otherwise valid,
    // so it restores onto the step it was left on.
    expect(await stepCounter(5)).toBeInTheDocument();
    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as {
        formData?: { machineType?: string; capacity?: number };
      };
      expect(draft.formData?.machineType).toBe("double");
      expect(draft.formData?.capacity).toBe(30);
    });
  });

  it("survives a draft whose selections are not arrays", async () => {
    // A non-array threw at `.filter` in the catalog prune effect.
    writeDraft({
      selectedMixers: "margarita",
      selectedExtras: { id: "cups" },
    });

    render(<OrderForm />);

    expect(await stepCounter(5)).toBeInTheDocument();
    await waitFor(() => {
      const draft = readDraft();
      expect(draft.formData?.selectedMixers).toEqual([]);
      expect(draft.formData?.selectedExtras).toEqual([]);
    });
  });

  it("clears a rental date that has fallen into the past and returns to the date step", async () => {
    writeDraft({ rentalDate: "2020-05-01", returnDate: "2020-05-02" });

    render(<OrderForm />);

    expect(await stepCounter(1)).toBeInTheDocument();
    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as {
        formData?: { rentalDate?: string; returnDate?: string };
      };
      expect(draft.formData?.rentalDate).toBe("");
      expect(draft.formData?.returnDate).toBe("");
    });
  });

  it("keeps a future rental date and the step the visitor left off on", async () => {
    writeDraft({}, "extras");

    render(<OrderForm />);

    expect(await stepCounter(4)).toBeInTheDocument();
  });

  it("drops an extra whose id has left the catalog", async () => {
    writeDraft({
      selectedExtras: [
        { id: "table-chairs", quantity: 1 },
        { id: "mixer-retired-flavour", quantity: 1 },
      ],
    });

    render(<OrderForm />);

    // Left alone, the orphaned id is invisible in every renderer but still
    // posted at checkout, where /api/save-booking 400s the whole booking.
    await waitFor(() => {
      expect(readDraft().formData?.selectedExtras).toEqual([
        { id: "table-chairs", quantity: 1 },
      ]);
    });
  });

  it("drops a tank mixer whose flavour has left the catalog", async () => {
    writeDraft({ selectedMixers: ["margarita", "retired-flavour"] });

    render(<OrderForm />);

    await waitFor(() => {
      expect(readDraft().formData?.selectedMixers).toEqual(["margarita"]);
    });
  });

  it("keeps an admin-added flavour that the static list does not know", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        mixers: { "mango-habanero": { label: "Mango Habanero", price: 22.5 } },
      }),
    })) as unknown as typeof fetch;

    writeDraft({
      selectedMixers: ["mango-habanero"],
      selectedExtras: [{ id: "mixer-mango-habanero", quantity: 1 }],
    });

    render(<OrderForm />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/settings");
    });
    await waitFor(() => {
      const draft = readDraft();
      expect(draft.formData?.selectedMixers).toEqual(["mango-habanero"]);
      expect(draft.formData?.selectedExtras).toEqual([
        { id: "mixer-mango-habanero", quantity: 1 },
      ]);
    });
  });
});

describe("OrderForm ?machine= param", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;
  });

  it.each(["quad", "Double", ""])(
    "renders rather than throwing for ?machine=%s",
    async (value) => {
      // `calculatePrice` throws on an unknown machine type and runs inside the
      // useState initialiser, so an unvalidated param took the whole order
      // page into the error boundary. Wrong case was enough.
      mockSearchParams = new URLSearchParams({ machine: value });

      render(<OrderForm />);

      expect(await stepCounter(1)).toBeInTheDocument();
    },
  );

  it("still honours a valid machine param", async () => {
    mockSearchParams = new URLSearchParams({ machine: "triple" });

    render(<OrderForm />);

    expect(await stepCounter(1)).toBeInTheDocument();
    await waitFor(() => {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as {
        formData?: { machineType?: string; capacity?: number };
      };
      expect(draft.formData?.machineType).toBe("triple");
      expect(draft.formData?.capacity).toBe(45);
    });
  });
});
