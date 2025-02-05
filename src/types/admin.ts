import { ReactNode } from "react";
import { MargaritaRental, PaymentStatus } from "./index";

export interface AdminOrdersResponse {
  orders: MargaritaRental[];
}

export interface AdminOrderResponse {
  order: MargaritaRental;
}

export interface OrderTableColumn {
  key: keyof MargaritaRental | "actions";
  label: string;
  sortable?: boolean;
  formatter?: (
    value: MargaritaRental[keyof MargaritaRental],
  ) => string | ReactNode;
}

export interface OrderFormData {
  status: MargaritaRental["status"];
  notes?: string;
  payment?: {
    status: PaymentStatus;
    amount: number;
  };
}
