import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json(
                { message: "Missing order ID" },
                { status: 400 }
            );
        }

        // Import PayPal SDK dynamically
        const sdk = await import("@paypal/checkout-server-sdk");

        const paypalClient = await initializePayPalSDK();
        const request_ = new sdk.default.orders.OrdersCaptureRequest(orderId);
        const capture = await paypalClient.execute(request_);

        if (capture.result.status === "COMPLETED") {
            return NextResponse.json({
                id: capture.result.id,
                status: capture.result.status,
            });
        } else {
            throw new Error("Payment capture failed");
        }
    } catch (error) {
        console.error("Error capturing PayPal payment:", error);
        return NextResponse.json(
            { message: "Failed to capture payment" },
            { status: 500 }
        );
    }
}
