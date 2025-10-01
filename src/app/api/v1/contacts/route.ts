import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";
import { Resend } from "resend";
import twilio from "twilio";

/**
 * API route for submitting contact form
 * POST /api/v1/contacts
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    await dbConnect();

    // Create the contact
    const contact = await Contact.create(data);

    // Send SMS notification if Twilio credentials are configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const toPhone = process.env.USER_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone && toPhone) {
      try {
        const twilioClient = twilio(accountSid, authToken);
        await twilioClient.messages.create({
          body:
            `New Contact Form Submission!\n` +
            `Name: ${contact.name}\n` +
            `Email: ${contact.email}\n` +
            `Phone: ${contact.phone}\n` +
            `Event Date: ${contact.eventDate}\n` +
            `Message: ${contact.message}\n` +
            `Submitted: ${new Date().toLocaleString()}`,
          from: fromPhone,
          to: toPhone,
        });
      } catch (smsError) {
        console.error("Error sending SMS notification:", smsError);
        // Continue with the request even if SMS fails
      }
    } else {
      console.warn(
        "Twilio credentials not fully configured - skipping SMS notification",
      );
    }

    // Configure Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      // Send notification email
      await resend.emails.send({
        from: "SATX Ritas Rentals <contact@satxritas.com>",
        to: ["satxbounce@gmail.com"], // Send to business email
        subject: "New Contact Form Submission - SATX Ritas",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb; border-radius: 8px;">
            <h1 style="color: #2b6cb0; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">New Contact Form Submission</h1>
            <div style="background-color: #fff; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #2b6cb0;">Contact Details:</strong></p>
              <ul style="list-style-type: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;"><strong>Name:</strong> ${contact.name}</li>
                <li style="margin-bottom: 8px;"><strong>Email:</strong> ${contact.email}</li>
                <li style="margin-bottom: 8px;"><strong>Phone:</strong> ${contact.phone}</li>
                <li style="margin-bottom: 8px;"><strong>Event Date:</strong> ${contact.eventDate}</li>
                <li style="margin-bottom: 8px;"><strong>Message:</strong> ${contact.message}</li>
                <li style="margin-bottom: 8px;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>
            <p style="font-size: 14px; color: #666;">This is an automated notification from your website contact form.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Error sending contact notification email:", emailError);
      // Continue with the request even if email fails
      // We don't want to fail the form submission just because the email didn't send
    }

    return NextResponse.json(
      { message: "Contact form submitted successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating contact:", error);

    // Check for validation errors
    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        {
          message: "Invalid contact data",
          details: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to submit contact form" },
      { status: 500 },
    );
  }
}
