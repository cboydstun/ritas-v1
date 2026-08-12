import { render, screen, fireEvent } from "@testing-library/react";
import { useModalFocus } from "@/hooks/useModalFocus";

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true">
      <input aria-label="first" />
      <input aria-label="middle" />
      <button>last</button>
    </div>
  );
}

// role="dialog" aria-modal="true" was declared on both admin modals with none
// of the behaviour it promises: aria-modal tells assistive technology the rest
// of the page is inert, so declaring it without containment is worse than not
// declaring it at all.
describe("useModalFocus", () => {
  it("moves focus to the first control on open", () => {
    render(<Dialog onClose={() => {}} />);

    expect(document.activeElement).toBe(screen.getByLabelText("first"));
  });

  it("closes on Escape", () => {
    const onClose = jest.fn();
    render(<Dialog onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last control back to the first", () => {
    render(<Dialog onClose={() => {}} />);
    const last = screen.getByRole("button", { name: "last" });
    last.focus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByLabelText("first"));
  });

  it("wraps Shift+Tab from the first control back to the last", () => {
    render(<Dialog onClose={() => {}} />);
    screen.getByLabelText("first").focus();

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "last" }),
    );
  });

  it("restores focus to the trigger on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<Dialog onClose={() => {}} />);
    expect(document.activeElement).not.toBe(trigger);

    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("leaves other keys alone", () => {
    const onClose = jest.fn();
    render(<Dialog onClose={onClose} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "a" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
