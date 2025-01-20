import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import clientPromise from "@/lib/mongodb";
import { MargaritaRental } from "@/types";

export async function POST(request: Request) {
  try {
    const { orderId, amount, rentalData } = await request.json();

    if (!orderId || !rentalData || !amount) {
      return NextResponse.json(
        { message: "Missing required data" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const sdk = await import("@paypal/checkout-server-sdk");

    const paypalClient = await initializePayPalSDK();
    // @ts-expect-error: TypeScript does not recognize OrdersCaptureRequest
    const request_ = new sdk.default.orders.OrdersCaptureRequest(orderId);
    const capture = await paypalClient.execute(request_);

    if (capture.result.status === "COMPLETED") {
      // Connect to MongoDB
      const client = await clientPromise;
      const db = client.db(process.env.MONGODB_DB);

      // Create rental document with payment information
      const rental: MargaritaRental = {
        ...rentalData,
        payment: {
          paypalTransactionId: capture.result.id,
          amount: parseFloat(amount),
          status: "completed",
          date: new Date(),
        },
        status: "confirmed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to MongoDB
      await db.collection("rentals").insertOne(rental);

      return NextResponse.json({
        id: capture.result.id,
        status: capture.result.status,
        rental: rental,
      });
    } else {
      throw new Error("Payment capture failed");
    }
  } catch (error) {
    console.error("Error capturing PayPal payment:", error);
    return NextResponse.json(
      { message: "Failed to capture payment" },
      { status: 500 },
    );
  }
}
