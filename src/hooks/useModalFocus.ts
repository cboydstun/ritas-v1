"use client";

import { useEffect, useRef } from "react";

/**
 * Focus management for a modal dialog.
 *
 * Both admin modals set `role="dialog" aria-modal="true"` but implemented
 * none of what that promises: focus never entered the dialog on open, Tab
 * walked straight out into the page behind it, Escape did nothing, and focus
 * was not restored on close. `aria-modal` tells assistive technology the rest
 * of the page is inert, so declaring it without containment is worse than not
 * declaring it at all.
 *
 * Returns a ref to attach to the dialog element.
 */
export function useModalFocus<T extends HTMLElement>(
  onClose: () => void,
): React.RefObject<T | null> {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Restored when the dialog unmounts, so the trigger keeps its place in the
    // tab order rather than dumping the user back at the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Visibility is judged by attributes, not layout: `offsetParent` and
    // `getClientRects()` are always empty under jsdom, so a layout-based
    // filter silently matches nothing there and this hook would appear to do
    // nothing in its own tests while working in a browser.
    const SELECTOR = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ]
      .map((part) => `${part}:not([hidden])`)
      .join(", ");

    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) => !el.closest("[hidden], [aria-hidden='true']"),
      );

    // Prefer the first real control; fall back to the dialog itself so focus
    // is never left outside.
    (focusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends. Without this, Tab from the last control moved to
      // the browser chrome and then into the page the dialog claims is inert.
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return dialogRef;
}
