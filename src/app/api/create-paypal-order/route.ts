import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";

export async function POST(request: Request) {
    try {
        const { amount, currency } = await request.json();

        if (!amount || !currency) {
            return NextResponse.json(
                { message: "Missing required payment details" },
                { status: 400 }
            );
        }

        // Import PayPal SDK dynamically
        const sdk = await import("@paypal/checkout-server-sdk");

        const paypalClient = await initializePayPalSDK();
        // @ts-expect-error: TypeScript does not recognize OrdersCreateRequest
        const request_ = new sdk.default.orders.OrdersCreateRequest();

        request_.prefer("return=representation");
        request_.requestBody({
            intent: "CAPTURE",
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amount.toString(),
                    },
                },
            ],
        });

        const order = await paypalClient.execute(request_);

        return NextResponse.json({ id: order.result.id });
    } catch (error) {
        console.error("Error creating PayPal order:", error);
        return NextResponse.json(
            { message: "Failed to create order" },
            { status: 500 }
        );
    }
}
