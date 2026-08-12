import { render } from "@testing-library/react";
import ViewItemListTracker from "../ViewItemListTracker";
import { trackEvent } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({
  trackEvent: jest.fn(),
}));

const trackEventMock = trackEvent as jest.Mock;

const items = [
  {
    item_id: "machine-single",
    item_name: "15L Single Tank Machine",
    item_category: "machine",
    price: 124.95,
  },
  {
    item_id: "machine-double",
    item_name: "30L Double Tank Machine",
    item_category: "machine",
    price: 149.95,
  },
];

describe("ViewItemListTracker", () => {
  beforeEach(() => trackEventMock.mockClear());

  it("emits one view_item_list carrying the list name and a positional index", () => {
    render(<ViewItemListTracker listName="pricing_page" items={items} />);

    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith("view_item_list", {
      item_list_name: "pricing_page",
      items: [
        { ...items[0], item_list_name: "pricing_page", quantity: 1, index: 0 },
        { ...items[1], item_list_name: "pricing_page", quantity: 1, index: 1 },
      ],
    });
  });

  it("keeps an explicit quantity", () => {
    render(
      <ViewItemListTracker
        listName="machine_types"
        items={[{ ...items[0], quantity: 3 }]}
      />,
    );

    expect(trackEventMock.mock.calls[0][1].items[0].quantity).toBe(3);
  });

  // `items` is a fresh array identity on every render, so without the ref
  // latch a parent re-render would count the same impression again.
  it("does not re-emit when the parent re-renders", () => {
    const { rerender } = render(
      <ViewItemListTracker listName="pricing_page" items={items} />,
    );

    rerender(
      <ViewItemListTracker listName="pricing_page" items={[...items]} />,
    );

    expect(trackEventMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    const { container } = render(
      <ViewItemListTracker listName="pricing_page" items={items} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
