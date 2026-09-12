import { render, screen, fireEvent, within } from "@testing-library/react";
import { ZipInventoryPanel } from "../ZipInventoryPanel";
import { buildZipFeeRows } from "@/lib/delivery/zipFeeRows";
import type { DeliverySettings } from "@/lib/delivery/zones";

const settings: DeliverySettings = {
  customFees: { "78209": 0, "78006": 75, "78163": 20 },
  insideZips: ["78209", "78210"],
  outsideZips: ["78006"],
};
const rows = buildZipFeeRows(settings);
const lists = { inside: settings.insideZips!, outside: settings.outsideZips! };

function panel(
  overrides: Partial<Parameters<typeof ZipInventoryPanel>[0]> = {},
) {
  const props = {
    rows,
    lists,
    selectedZip: null,
    isSaving: false,
    onSelectZip: jest.fn(),
    onSetZone: jest.fn(),
    ...overrides,
  };
  render(<ZipInventoryPanel {...props} />);
  return props;
}

describe("counts", () => {
  it("counts serviced as priced-only, not as everything configured", () => {
    // 78210 is listed with no fee: it is configured, and it is not serviced.
    panel();
    expect(screen.getByText(/3 serviced · 4 configured/)).toBeInTheDocument();
  });
});

describe("the unpriced-listed warning", () => {
  it("names the ZIPs that look covered and are refused", () => {
    panel();
    expect(
      screen.getByText(/1 ZIP is listed with no surcharge/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Checkout refuses orders to these/),
    ).toBeInTheDocument();
  });

  it("offers the flagged ZIP for pricing in one click", () => {
    const props = panel();
    const warning = screen
      .getByText(/listed with no surcharge/)
      .closest("div")!;
    fireEvent.click(within(warning).getByRole("button", { name: "78210" }));
    expect(props.onSelectZip).toHaveBeenCalledWith("78210");
  });

  it("says nothing when every listed ZIP is priced", () => {
    panel({
      rows: buildZipFeeRows({ ...settings, insideZips: ["78209"] }),
      lists: { inside: ["78209"], outside: ["78006"] },
    });
    expect(
      screen.queryByText(/listed with no surcharge/),
    ).not.toBeInTheDocument();
  });

  it("does not flag a ZIP priced at zero", () => {
    // $0 is a real price. Flagging free ZIPs would make the warning noise.
    panel();
    const warning = screen
      .getByText(/listed with no surcharge/)
      .closest("div")!;
    expect(
      within(warning).queryByRole("button", { name: "78209" }),
    ).not.toBeInTheDocument();
  });
});

describe("rows", () => {
  it("shows each configured ZIP once, with its fee or 'none'", () => {
    panel();
    expect(screen.getAllByRole("button", { name: /78006/ })).toHaveLength(1);
    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("cycles a ZIP's zone inside → outside → no zone", () => {
    const props = panel();
    fireEvent.click(screen.getAllByTitle(/Cycle zone/)[2]); // 78209, inside
    expect(props.onSetZone).toHaveBeenCalledWith("78209", "outside");
  });

  it("refuses zone edits before the lists have loaded", () => {
    panel({ lists: null });
    for (const button of screen.getAllByTitle(/Cycle zone/)) {
      expect(button).toBeDisabled();
    }
  });

  it("filters by ZIP prefix", () => {
    panel();
    fireEvent.change(screen.getByLabelText("Filter by ZIP prefix"), {
      target: { value: "7820" },
    });
    expect(screen.getAllByRole("button", { name: /78209/ })).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /78006/ }),
    ).not.toBeInTheDocument();
  });
});
