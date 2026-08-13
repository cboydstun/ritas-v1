/**
 * The section editor's list mechanics — add, reorder, remove — and the
 * per-kind field groups behind them.
 *
 * This is the most bug-prone new code in the landing-page feature: an
 * off-by-one in the reorder swap silently rearranges a published page, and
 * "Add section" producing a shape the API rejects makes the editor unusable.
 * Neither has a visual symptom in review.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import SectionListEditor from "@/components/admin/SectionListEditor";
import type { LandingSection } from "@/lib/landing";

// The editor fetches the shared-block list on mount to populate its picker.
const mockFetch = jest.fn();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
});

/**
 * Renders with a controlled `sections` array and reports what it becomes.
 *
 * Awaited inside `act` because the editor fetches the shared-block list on
 * mount: without it the resulting `setBlocks` lands after the test body and
 * React warns about an update outside `act`.
 */
async function setup(initial: LandingSection[], allowBlockRefs = true) {
  const onChange = jest.fn();
  await act(async () => {
    render(
      <SectionListEditor
        sections={initial}
        onChange={onChange}
        allowBlockRefs={allowBlockRefs}
      />,
    );
  });
  return onChange;
}

const hero: LandingSection = { kind: "hero", heading: "First" };
const cta: LandingSection = { kind: "cta", headline: "Second" };

describe("adding sections", () => {
  it("appends a default section of the chosen kind", async () => {
    const onChange = await setup([]);

    fireEvent.change(screen.getByLabelText("Add a section"), {
      target: { value: "faq" },
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ kind: "faq" }),
    ]);
  });

  it("appends rather than replacing what is already there", async () => {
    const onChange = await setup([hero]);

    fireEvent.change(screen.getByLabelText("Add a section"), {
      target: { value: "cta" },
    });

    expect(onChange.mock.calls[0][0]).toHaveLength(2);
    expect(onChange.mock.calls[0][0][0]).toEqual(hero);
  });

  it("ignores the placeholder option", async () => {
    const onChange = await setup([]);

    fireEvent.change(screen.getByLabelText("Add a section"), {
      target: { value: "" },
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers shared blocks as a group, and inserts a reference", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { slug: "delivery-includes", name: "What delivery includes" },
      ],
    });
    const onChange = await setup([]);

    const option = await screen.findByRole("option", {
      name: "What delivery includes",
    });
    fireEvent.change(screen.getByLabelText("Add a section"), {
      target: { value: (option as HTMLOptionElement).value },
    });

    expect(onChange).toHaveBeenCalledWith([
      { kind: "blockRef", blockSlug: "delivery-includes" },
    ]);
  });

  // A block may not contain a reference to another block, so no cycle is
  // expressible and resolution needs no depth limit.
  it("hides the shared-block group when references are not allowed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ slug: "a", name: "Block A" }],
    });
    await setup([], false);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("option", { name: "Block A" }),
    ).not.toBeInTheDocument();
  });
});

describe("reordering", () => {
  it("swaps a section with the one above it", async () => {
    const onChange = await setup([hero, cta]);

    fireEvent.click(
      screen.getByRole("button", { name: "Move Booking CTA section up" }),
    );

    expect(onChange).toHaveBeenCalledWith([cta, hero]);
  });

  it("swaps a section with the one below it", async () => {
    const onChange = await setup([hero, cta]);

    fireEvent.click(
      screen.getByRole("button", { name: "Move Hero section down" }),
    );

    expect(onChange).toHaveBeenCalledWith([cta, hero]);
  });

  it("disables the moves that would fall off either end", async () => {
    await setup([hero, cta]);

    expect(
      screen.getByRole("button", { name: "Move Hero section up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Booking CTA section down" }),
    ).toBeDisabled();
  });
});

describe("removing", () => {
  it("drops the confirmed section and leaves the rest in order", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const onChange = await setup([hero, cta]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Hero section" }),
    );

    expect(onChange).toHaveBeenCalledWith([cta]);
  });

  it("keeps the section when the admin cancels", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);
    const onChange = await setup([hero]);

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Hero section" }),
    );

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("row summaries", () => {
  it.each([
    [{ kind: "hero", heading: "Hello" } as LandingSection, "Hello"],
    [
      { kind: "faq", heading: "Questions", items: [] } as LandingSection,
      "Questions",
    ],
    [{ kind: "nearbyAreas", forSlug: "" } as LandingSection, "No area chosen"],
    [{ kind: "blockRef", blockSlug: "" } as LandingSection, "No block chosen"],
  ])("summarises a collapsed %#", async (section, expected) => {
    await setup([section]);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("strips tags from a rich-text summary", async () => {
    await setup([{ kind: "richText", html: "<p>Plain words</p>" }]);

    expect(screen.getByText("Plain words")).toBeInTheDocument();
  });
});

describe("per-kind fields", () => {
  it("edits a hero heading through to onChange", async () => {
    const onChange = await setup([hero]);

    fireEvent.change(screen.getByDisplayValue("First"), {
      target: { value: "Changed" },
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ heading: "Changed" }),
    ]);
  });

  it("says there is nothing to edit on a pricing section", async () => {
    await setup([{ kind: "pricingCards", source: "machines" }]);

    expect(screen.getByText(/come from Settings/)).toBeInTheDocument();
  });

  // Not an error for the visitor — the renderer drops an unresolvable
  // reference — but the admin needs to see the section contributes nothing.
  it("flags a reference to a block that does not exist", async () => {
    await setup([{ kind: "blockRef", blockSlug: "gone" }]);

    expect(screen.getByText(/will render nothing/)).toBeInTheDocument();
  });

  it("adds and removes items within a feature list", async () => {
    const onChange = await setup([
      { kind: "features", items: [{ body: "One" }, { body: "Two" }] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(onChange.mock.calls[0][0][0].items).toHaveLength(3);

    onChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^Remove item 1/ }));
    expect(onChange.mock.calls[0][0][0].items).toEqual([{ body: "Two" }]);
  });

  it("reorders items within an FAQ list", async () => {
    const onChange = await setup([
      {
        kind: "faq",
        items: [
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ],
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Move Q2 up" }));

    expect(onChange.mock.calls[0][0][0].items[0].question).toBe("Q2");
  });

  // A half-filled link fails validation on a field the admin thought was
  // empty, so both blank means "no link" rather than an invalid one.
  it("clears a hero CTA when both of its fields are emptied", async () => {
    const onChange = await setup([
      { kind: "hero", heading: "H", primaryCta: { label: "Go", href: "" } },
    ]);

    const group = screen.getByRole("group", { name: "Primary button" });
    fireEvent.change(within(group).getByDisplayValue("Go"), {
      target: { value: "" },
    });

    expect(onChange.mock.calls[0][0][0].primaryCta).toBeUndefined();
  });
});
