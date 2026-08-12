import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { Contact } from "@/models/contact";
import { Resend } from "resend";
import twilio from "twilio";
import { guardPublicWrite } from "@/lib/api-guard";
import { contactSchema, escapeHtml, firstIssueMessage } from "@/lib/validation";
import { BUSINESS_TIME_ZONE } from "@/lib/dates";

/**
 * API route for submitting contact form
 * POST /api/v1/contacts
 */
/**
 * Now, rendered in the business's timezone.
 *
 * Vercel functions run UTC, so a bare `toLocaleString()` stamped every evening
 * submission with tomorrow's date in the operator's SMS and email.
 */
function submittedAt(): string {
  return new Date().toLocaleString("en-US", { timeZone: BUSINESS_TIME_ZONE });
}

export async function POST(request: Request) {
  try {
    const guard = await guardPublicWrite(request, {
      route: "contacts",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guard.ok) return guard.response;

    const parsed = contactSchema.safeParse(guard.data);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstIssueMessage(parsed.error) },
        { status: 400 },
      );
    }

    await dbConnect();

    // Explicit fields only — `Contact.create(rawBody)` let callers set
    // `status`, `createdAt` and anything else the schema declares.
    const contact = await Contact.create({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      eventDate: parsed.data.eventDate,
      message: parsed.data.message,
    });

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
            `Submitted: ${submittedAt()}`,
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

    try {
      // Inside the try: the Resend constructor throws when RESEND_API_KEY is
      // unset, and the document is already persisted at this point.
      const resend = new Resend(process.env.RESEND_API_KEY);

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
                <li style="margin-bottom: 8px;"><strong>Name:</strong> ${escapeHtml(contact.name)}</li>
                <li style="margin-bottom: 8px;"><strong>Email:</strong> ${escapeHtml(contact.email)}</li>
                <li style="margin-bottom: 8px;"><strong>Phone:</strong> ${escapeHtml(contact.phone)}</li>
                <li style="margin-bottom: 8px;"><strong>Event Date:</strong> ${escapeHtml(contact.eventDate)}</li>
                <li style="margin-bottom: 8px;"><strong>Message:</strong> ${escapeHtml(contact.message)}</li>
                <li style="margin-bottom: 8px;"><strong>Submitted:</strong> ${submittedAt()}</li>
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

    // Detail stays in the logs — Mongoose validation messages expose field
    // paths and index names.
    if (error instanceof Error && error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Invalid contact data" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Failed to submit contact form" },
      { status: 500 },
    );
  }
}
