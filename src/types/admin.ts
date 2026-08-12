import { ReactNode } from "react";
import { MargaritaRental } from "./index";

/**
 * `AdminOrdersResponse`, `AdminOrderResponse` and a second `OrderFormData` used
 * to live here with no importers. The `OrderFormData` in particular collided by
 * name with the live one in `src/components/order/types.ts`, which is the one
 * every consumer actually means.
 */
export interface OrderTableColumn {
  key: keyof MargaritaRental | "actions";
  label: string;
  sortable?: boolean;
  formatter?: (
    value: MargaritaRental[keyof MargaritaRental],
  ) => string | ReactNode;
}
