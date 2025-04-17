import { NextResponse } from "next/server";
import { initializePayPalSDK } from "@/lib/paypal-server";
import dbConnect from "@/lib/mongodb";
import { Rental } from "@/models/rental";
import twilio from "twilio";
import {
  sendCustomEmail,
  sendEmailWithReactComponent,
} from "@/lib/email-service";
import { EmailTemplate } from "@/components/email-template";
import {
  generateQuickBooksInvoice,
  logQuickBooksError,
} from "@/lib/quickbooks-service";

export async function POST(request: Request) {
  try {
    const { orderId, amount, rentalData } = await request.json();

    if (!orderId || !amount) {
      return NextResponse.json(
        { message: "Missing required data" },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sdkModule = paypalSdk as any;

      // Log the SDK structure for debugging
      console.log("SDK keys:", Object.keys(sdkModule));
      if (sdkModule.default) {
        console.log("SDK default keys:", Object.keys(sdkModule.default));
        if (sdkModule.default.orders) {
          console.log(
            "SDK default.orders keys:",
            Object.keys(sdkModule.default.orders),
          );
        }
      }

      // In development mode, create a custom request object that works with our custom client
      if (process.env.NODE_ENV !== "production") {
        console.log("Using development mode request object for capture");

        // Create a custom request object with the properties our custom client expects
        // For capture requests, PayPal API expects an empty body or minimal data
        request_ = {
          // Use a path that clearly indicates this is a capture request
          path: `/v2/checkout/orders/${orderId}/capture`,
          verb: "POST",
          // Empty body for capture request as per PayPal documentation
          body: {},
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
        };

        console.log(
          `Creating capture request for order ${orderId} with path: ${request_.path}`,
        );
      } else {
        // In production, use the standard SDK
        // Create the request object using the appropriate path
        if (
          sdkModule.default &&
          sdkModule.default.orders &&
          sdkModule.default.orders.OrdersCaptureRequest
        ) {
          request_ = new sdkModule.default.orders.OrdersCaptureRequest(orderId);
        } else if (sdkModule.orders && sdkModule.orders.OrdersCaptureRequest) {
          request_ = new sdkModule.orders.OrdersCaptureRequest(orderId);
        } else if (
          sdkModule.default &&
          sdkModule.default.OrdersCaptureRequest
        ) {
          request_ = new sdkModule.default.OrdersCaptureRequest(orderId);
        } else if (sdkModule.OrdersCaptureRequest) {
          request_ = new sdkModule.OrdersCaptureRequest(orderId);
        } else {
          throw new Error("Could not find OrdersCaptureRequest in PayPal SDK");
        }
      }
    } catch (error) {
      console.error("Error creating PayPal capture request:", error);
      throw new Error(
        `Failed to create PayPal capture request: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
    const capture = await paypalClient.execute(request_);

    if (capture.result.status === "COMPLETED") {
      // Send SMS notification if Twilio credentials are configured
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;
      const toPhone = process.env.USER_PHONE_NUMBER;

      if (accountSid && authToken && fromPhone && toPhone) {
        const twilioClient = twilio(accountSid, authToken);
        try {
          // Get rental data from either new rental data or existing rental
          const rental =
            rentalData || (await Rental.findOne({ paypalOrderId: orderId }));
          if (rental) {
            // Parse the rental date and time
            const [year, month, day] = rental.rentalDate.split("-");
            const [hour] = rental.rentalTime.split(":");
            const rentalDateTime = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
            );

            // Format the date and time
            const formattedDate = rentalDateTime.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            // Format time to 12-hour format
            const formattedTime = `${rental.rentalTime}${parseInt(hour) >= 12 ? "PM" : "AM"}`;

            // Prepare extras text if any
            const extrasText =
              rental.selectedExtras && rental.selectedExtras.length > 0
                ? `Extras: ${rental.selectedExtras
                    .map(
                      (extra: { name: string; quantity?: number }) =>
                        `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
                    )
                    .join(", ")}\n`
                : "";

            await twilioClient.messages.create({
              body:
                `Slushy Machine Rental!\n` +
                `Date: ${formattedDate}\n` +
                `Time: ${formattedTime}\n` +
                `Address: ${rental.customer.address.street}, ${rental.customer.address.city}, ${rental.customer.address.state} ${rental.customer.address.zipCode}\n` +
                `Machine: ${rental.machineType}\n` +
                `Mixers: ${rental.selectedMixers.join(", ") || "None"}\n` +
                `${extrasText}` +
                `Customer: ${rental.customer.name}\n` +
                `Phone: ${rental.customer.phone}\n` +
                `Total: $${amount}`,
              from: fromPhone,
              to: toPhone,
            });
          }
        } catch (smsError) {
          console.error("Error sending SMS:", smsError);
          // Continue with order processing even if SMS fails
        }
      } else {
        console.warn(
          "Twilio credentials not fully configured - skipping SMS notification",
        );
      }

      // Connect to MongoDB using Mongoose
      await dbConnect();

      // First try to find the rental
      const existingRental = await Rental.findOne({ paypalOrderId: orderId });

      if (!existingRental && rentalData) {
        // If rental not found but we have rental data, create it
        const rental = new Rental({
          ...rentalData,
          selectedExtras: rentalData.selectedExtras || [],
          paypalOrderId: orderId,
          status: "confirmed",
          payment: {
            paypalTransactionId: capture.result.id,
            amount: parseFloat(amount),
            status: "completed",
            date: new Date(),
          },
        });
        await rental.save();
        return NextResponse.json({
          id: capture.result.id,
          status: capture.result.status,
          rental: rental.toObject(),
        });
      }

      if (!existingRental) {
        console.error("No rental found for PayPal order:", orderId);
        throw new Error("Rental not found and no rental data provided");
      }

      // Update the existing rental
      const updatedRental = await Rental.findOneAndUpdate(
        { paypalOrderId: orderId },
        {
          $set: {
            status: "confirmed",
            payment: {
              paypalTransactionId: capture.result.id,
              amount: parseFloat(amount),
              status: "completed",
              date: new Date(),
            },
            updatedAt: new Date(),
          },
        },
        {
          new: true, // Return the updated document
          runValidators: true, // Run schema validators on update
        },
      );

      if (!updatedRental) {
        throw new Error("Failed to update rental");
      }

      try {
        // Send confirmation email using our email service
        // Since EmailTemplate is a React Server Component that returns a Promise<ReactNode>,
        // we need to convert it to a format that Resend can use
        const emailProps = {
          orderId,
          customer: updatedRental.customer,
          machineType: updatedRental.machineType,
          rentalDate: updatedRental.rentalDate,
          rentalTime: updatedRental.rentalTime,
          returnDate: updatedRental.returnDate,
          returnTime: updatedRental.returnTime,
          selectedMixers: updatedRental.selectedMixers,
          selectedExtras: updatedRental.selectedExtras,
          amount,
          capacity: updatedRental.capacity,
        };

        // Instead of using sendEmailWithReactComponent, we'll use sendCustomEmail
        // and render the email template to HTML
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
            <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
              Thank you for your order!
            </h1>
            <p style="font-size: 16px;">Dear ${updatedRental.customer.name},</p>
            <p style="font-size: 16px;">
              We have received your rental order for a ${updatedRental.machineType}.
            </p>

            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0;">
                <strong style="color: #2b6cb0;">Order ID:</strong> ${orderId}
              </p>
            </div>

            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;">
                <strong style="color: #2b6cb0;">Rental Details:</strong>
              </p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;">
                  🗓 Rental Date: ${updatedRental.rentalDate} at ${updatedRental.rentalTime}
                </li>
                <li style="margin-bottom: 8px;">
                  🗓 Return Date: ${updatedRental.returnDate} at ${updatedRental.returnTime}
                </li>
                <li style="margin-bottom: 8px;">
                  🍹 Selected Mixers: ${updatedRental.selectedMixers.join(", ")}
                </li>
                ${
                  updatedRental.selectedExtras &&
                  updatedRental.selectedExtras.length > 0
                    ? `
                <li style="margin-bottom: 8px;">
                  🎉 Party Extras: ${updatedRental.selectedExtras
                    .map(
                      (extra: { name: string; quantity?: number }) =>
                        `${extra.name}${extra.quantity && extra.quantity > 1 ? ` (${extra.quantity}x)` : ""}`,
                    )
                    .join(", ")}
                </li>
                `
                    : ""
                }
                <li style="margin-bottom: 8px;">💰 Total Amount: $${amount}</li>
                <li style="margin-bottom: 8px;">
                  ⚡ Machine Capacity: ${updatedRental.capacity}L
                </li>
              </ul>
            </div>

            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;">
                <strong style="color: #2b6cb0;">Delivery Address:</strong>
              </p>
              <p style="margin: 0;">
                ${updatedRental.customer.address.street}
                <br />
                ${updatedRental.customer.address.city}, ${updatedRental.customer.address.state} ${updatedRental.customer.address.zipCode}
              </p>
            </div>

            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;">
                <strong style="color: #2b6cb0;">Contact Information:</strong>
              </p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;">📱 Phone: ${updatedRental.customer.phone}</li>
                <li style="margin-bottom: 8px;">📧 Email: ${updatedRental.customer.email}</li>
              </ul>
            </div>

            <p style="font-size: 16px; background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              If you have any questions or need to make changes to your order, please do
              not hesitate to contact us. Please reference your Order ID in any
              communications.
            </p>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
              Best regards,
              <br />
              SATX Ritas Margarita Rentals Team
            </p>
          </div>
        `;

        const result = await sendCustomEmail({
          to: [process.env.NODEMAILER_USERNAME as string],
          bcc: [updatedRental.customer.email as string], // BCC the customer
          subject: "SATX Ritas Margarita Rentals - Order Confirmation",
          html: emailHtml,
        });

        console.log("Email sent successfully with ID:", result.id);
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        // Continue with the order process even if email fails
        // We don't want to fail the order just because the email didn't send
      }

      // Generate QuickBooks invoice
      let invoiceData = null;
      try {
        // Only generate invoice if QuickBooks is configured
        if (
          process.env.QB_CLIENT_ID &&
          process.env.QB_CLIENT_SECRET &&
          process.env.QB_REALM_ID
        ) {
          console.log(
            "Generating QuickBooks invoice for rental:",
            updatedRental._id,
          );

          // Generate the invoice
          const invoice = await generateQuickBooksInvoice({
            ...updatedRental.toObject(),
            _id: updatedRental._id,
          });

          // Include invoice info in response
          invoiceData = {
            id: invoice.Id,
            number: invoice.DocNumber,
          };

          console.log(
            "Successfully generated QuickBooks invoice:",
            invoiceData,
          );
        } else {
          console.log(
            "QuickBooks not configured - skipping invoice generation",
          );
        }
      } catch (qbError) {
        // Log error but don't fail the order process
        console.error("Error generating QuickBooks invoice:", qbError);

        // Check if this is an authentication error
        const errorStr = String(qbError);
        if (
          errorStr.includes("authenticate") ||
          errorStr.includes("expired") ||
          errorStr.includes("invalid_token") ||
          errorStr.includes("invalid_grant") ||
          errorStr.includes("Token expired")
        ) {
          console.warn(
            "QuickBooks authentication has expired. Invoice generation will be retried later.",
          );

          // Update rental with authentication error
          await Rental.findByIdAndUpdate(updatedRental._id, {
            $set: {
              "quickbooks.syncStatus": "auth_error",
              "quickbooks.lastSyncAttempt": new Date(),
              "quickbooks.syncError":
                "QuickBooks authentication has expired. Please reconnect in the admin panel.",
            },
          });
        } else {
          // Store error for later retry
          await logQuickBooksError(updatedRental._id.toString(), qbError);
        }

        // Add error info to response
        invoiceData = {
          error: "Invoice generation failed but will be retried later",
          errorType: errorStr.includes("expired")
            ? "auth_expired"
            : "general_error",
        };
      }

      return NextResponse.json({
        id: capture.result.id,
        status: capture.result.status,
        rental: updatedRental.toObject(),
        invoice: invoiceData,
      });
    } else {
      // Capture wasn't successful - log detailed information
      console.error(
        "PayPal capture failed with status:",
        capture.result.status,
      );
      console.error(
        "Capture result details:",
        JSON.stringify(capture.result, null, 2),
      );

      // Update rental payment status to failed if capture wasn't successful
      await dbConnect();
      const rental = await Rental.findOneAndUpdate(
        { paypalOrderId: orderId },
        {
          $set: {
            "payment.status": "failed",
            "payment.errorDetails": JSON.stringify(capture.result),
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!rental) {
        console.error("No rental found for PayPal order:", orderId);
        throw new Error("Rental not found for failed payment");
      }

      // Throw a more detailed error with the status
      throw new Error(
        `Payment capture failed with status: ${capture.result.status}`,
      );
    }
  } catch (error) {
    console.error("Error capturing PayPal payment:", error);

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

    // Prepare a more detailed error response
    let errorMessage = "Failed to capture payment";
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = `PayPal Error: ${error.message}`;
      errorDetails = {
        name: error.name,
        message: error.message,
      };
    }

    // If it's a PayPal API error, include the details
    if (error && typeof error === "object" && "details" in error) {
      errorDetails = {
        ...errorDetails,
        paypalDetails: error.details,
      };
    }

    return NextResponse.json(
      {
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
