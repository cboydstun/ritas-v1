import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";

export async function POST(request: Request) {
  try {
    const { amount, currency, rentalData } = await request.json();

    if (!amount || !currency) {
      return NextResponse.json(
        { message: "Missing required payment details" },
        { status: 400 },
      );
    }

    // Import PayPal SDK dynamically
    const paypalSdk = await import("@paypal/checkout-server-sdk");
    const paypalClient = await initializePayPalSDK();
    
    // Create a request object that works with our custom client
    let request_;
    
    try {
      // Use a type assertion to access the SDK structure
      const sdkModule = paypalSdk as any;
      
      // Log the SDK structure for debugging
      console.log("SDK keys:", Object.keys(sdkModule));
      if (sdkModule.default) {
        console.log("SDK default keys:", Object.keys(sdkModule.default));
        if (sdkModule.default.orders) {
          console.log("SDK default.orders keys:", Object.keys(sdkModule.default.orders));
        }
      }
      
      // In development mode, create a custom request object that works with our custom client
      if (process.env.NODE_ENV !== "production") {
        console.log("Using development mode request object");
        
        // Create a custom request object with the properties our custom client expects
        request_ = {
          path: "/v2/checkout/orders",
          verb: "POST",
          body: {
            intent: "CAPTURE",
            purchase_units: [
              {
                amount: {
                  currency_code: currency,
                  value: amount.toString(),
                },
              },
            ],
          },
          headers: {
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
        };
      } else {
        // In production, use the standard SDK
        // Create the request object using the appropriate path
        if (sdkModule.default && sdkModule.default.orders && sdkModule.default.orders.OrdersCreateRequest) {
          request_ = new sdkModule.default.orders.OrdersCreateRequest();
        } else if (sdkModule.orders && sdkModule.orders.OrdersCreateRequest) {
          request_ = new sdkModule.orders.OrdersCreateRequest();
        } else if (sdkModule.default && sdkModule.default.OrdersCreateRequest) {
          request_ = new sdkModule.default.OrdersCreateRequest();
        } else if (sdkModule.OrdersCreateRequest) {
          request_ = new sdkModule.OrdersCreateRequest();
        } else {
          throw new Error("Could not find OrdersCreateRequest in PayPal SDK");
        }
        
        request_.prefer("return=representation");
        
        // Create the request body
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
      }
    } catch (error) {
      console.error("Error creating PayPal request:", error);
      throw new Error(`Failed to create PayPal request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const order = await paypalClient.execute(request_);

    // If rental data is provided, create a pending rental
    if (rentalData) {
      try {
        await dbConnect();

        // Create a new rental with pending status
        const rental = new Rental({
          machineType: rentalData.machineType,
          capacity: rentalData.capacity,
          selectedMixers: rentalData.selectedMixers,
          selectedExtras: rentalData.selectedExtras || [],
          price: rentalData.price,
          rentalDate: rentalData.rentalDate,
          rentalTime: rentalData.rentalTime,
          returnDate: rentalData.returnDate,
          returnTime: rentalData.returnTime,
          customer: {
            name: rentalData.customer.name,
            email: rentalData.customer.email,
            phone: rentalData.customer.phone,
            address: {
              street: rentalData.customer.address.street,
              city: rentalData.customer.address.city,
              state: rentalData.customer.address.state,
              zipCode: rentalData.customer.address.zipCode,
            },
          },
          notes: rentalData.notes || "",
          paypalOrderId: order.result.id,
          status: "pending",
          payment: {
            paypalTransactionId: order.result.id,
            amount: parseFloat(amount),
            status: "pending",
            date: new Date(),
          },
        });

        // Save the rental
        const savedRental = await rental.save();

        return NextResponse.json({
          id: order.result.id,
          rentalId: savedRental._id,
        });
      } catch (dbError) {
        console.error("Error saving rental:", dbError);
        if (dbError instanceof Error) {
          console.error("Error details:", {
            name: dbError.name,
            message: dbError.message,
            stack: dbError.stack,
          });
        }
        // Even if saving the rental fails, return the PayPal order ID
        // as the payment flow can still continue
        return NextResponse.json({ id: order.result.id });
      }
    }

    // If no rental data, just return the PayPal order ID
    return NextResponse.json({ id: order.result.id });
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    // Log detailed error information
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    // Check if it's a PayPal API error
    if (error && typeof error === "object" && "details" in error) {
      console.error("PayPal API error details:", error.details);
    }

    let errorMessage = "Failed to create order";
    if (error instanceof Error) {
      errorMessage = `PayPal Error: ${error.message}`;
    }

    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
