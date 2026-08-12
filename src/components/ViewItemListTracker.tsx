"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

export interface ViewItemListItem {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity?: number;
}

interface ViewItemListTrackerProps {
  /** GA4 `item_list_name` — the surface the products were seen on. */
  listName: string;
  items: ViewItemListItem[];
}

/**
 * Emits one GA4 `view_item_list` on mount and renders nothing.
 *
 * Exists so a **server** component can report a product impression: `/pricing`
 * is the site's second-most-visited page and its highest-intent one, and it
 * was invisible to GA4 as a product surface — the funnel had no step between
 * "landed" and "opened the wizard", so a 78% bounce there could not be
 * distinguished from disinterest.
 *
 * The list is rendered server-side, so the items are passed in as props
 * rather than derived here; that keeps the prices identical to the ones on
 * the page, which come from `publicPriceTable()` with admin overrides applied.
 */
export default function ViewItemListTracker({
  listName,
  items,
}: ViewItemListTrackerProps): null {
  // One impression per mount, enforced by a ref rather than an empty
  // dependency array: `items` is a new array identity on every render, so an
  // honest dependency list would re-fire on any parent re-render and inflate
  // the count, and suppressing the lint rule would hide that from the next
  // reader. The latch makes the deps truthful and the behaviour correct.
  const impressionSent = useRef(false);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;

    trackEvent("view_item_list", {
      item_list_name: listName,
      items: items.map((item, index) => ({
        ...item,
        item_list_name: listName,
        quantity: item.quantity ?? 1,
        index,
      })),
    });
  }, [listName, items]);

  return null;
}
