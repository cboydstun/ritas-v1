import { useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { MargaritaRental } from "@/types";

interface PayPalCheckoutProps {
  amount: number;
  currency?: string;
  rentalData: Omit<
    MargaritaRental,
    "payment" | "status" | "createdAt" | "updatedAt"
  >;
  onSuccess: (orderId: string) => void;
  onError: (error: Error) => void;
}

export const PayPalCheckout: React.FC<PayPalCheckoutProps> = ({
  amount,
  currency = "USD",
  rentalData,
  onSuccess,
  onError,
}) => {
  const [isPending, setIsPending] = useState(false);

  const createOrder = async () => {
    try {
      setIsPending(true);
      const response = await fetch("/api/create-paypal-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount.toFixed(2),
          currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      const orderData = await response.json();
      return orderData.id;
    } catch (error) {
      console.error("Error creating PayPal order:", error);
      onError(
        error instanceof Error ? error : new Error("Failed to create order")
      );
      return "";
    } finally {
      setIsPending(false);
    }
  };

  const onApprove = async (data: { orderID: string }) => {
    try {
      setIsPending(true);
      const response = await fetch("/api/capture-paypal-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: data.orderID,
          amount: amount.toFixed(2),
          currency,
          rentalData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to capture payment");
      }

      const orderData = await response.json();
      onSuccess(orderData.id);
    } catch (error) {
      console.error("Error capturing PayPal payment:", error);
      onError(
        error instanceof Error ? error : new Error("Failed to capture payment")
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <PayPalButtons
        createOrder={async () => {
          const orderId = await createOrder();
          if (!orderId) {
            throw new Error("Failed to create order");
          }
          return orderId;
        }}
        onApprove={async (data) => {
          await onApprove(data);
        }}
        onError={(err: any) => {
          console.error("PayPal error:", err);
          onError(new Error(err?.message || "PayPal payment error"));
        }}
        disabled={isPending}
        style={{ layout: "vertical" }}
      />
    </div>
  );
};
