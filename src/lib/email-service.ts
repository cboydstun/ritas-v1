import { Resend } from "resend";
import {
  EmailTemplate,
  SentEmail,
  IEmailTemplate,
  ISentEmail,
} from "@/models/email-template";
import dbConnect from "@/lib/mongodb";
import { ReactElement } from "react";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Replace variables in template
export const replaceVariables = (
  template: string,
  variables: Record<string, string>,
) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value || "");
  }
  return result;
};

// Send email using template
export const sendEmailWithTemplate = async ({
  templateId,
  to,
  cc,
  bcc,
  variables,
  from = process.env.DEFAULT_EMAIL_FROM || "SATX Ritas <orders@satxritas.com>",
}: {
  templateId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  variables: Record<string, string>;
  from?: string;
}): Promise<{ id: string; sentEmail: ISentEmail }> => {
  await dbConnect();

  // Get template
  const template = await EmailTemplate.findById(templateId);
  if (!template) {
    throw new Error(`Email template with ID ${templateId} not found`);
  }

  // Replace variables in subject and body
  const subject = replaceVariables(template.subject, variables);
  const html = replaceVariables(template.body, variables);

  // Send email with Resend
  const { data, error } = await resend.emails.send({
    from,
    to,
    cc,
    bcc,
    subject,
    html,
  });

  if (error) {
    // Create a record of the failed email
    const sentEmail = new SentEmail({
      templateId,
      subject,
      body: html,
      from,
      to,
      cc: cc || [],
      bcc: bcc || [],
      status: "failed",
      resendId: "error",
      metadata: new Map([["error", error.message]]),
    });

    await sentEmail.save();

    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data || !data.id) {
    throw new Error("Failed to send email: No ID returned from Resend");
  }

  // Log sent email
  const sentEmail = new SentEmail({
    templateId,
    subject,
    body: html,
    from,
    to,
    cc: cc || [],
    bcc: bcc || [],
    resendId: data.id,
  });

  await sentEmail.save();

  return { id: data.id, sentEmail };
};

// Send email with React component
export const sendEmailWithReactComponent = async ({
  to,
  cc,
  bcc,
  subject,
  react,
  from = process.env.DEFAULT_EMAIL_FROM || "SATX Ritas <orders@satxritas.com>",
}: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  react: ReactElement;
  from?: string;
}): Promise<{ id: string; sentEmail: ISentEmail }> => {
  await dbConnect();

  // Send email with Resend
  const { data, error } = await resend.emails.send({
    from,
    to,
    cc,
    bcc,
    subject,
    react,
  });

  if (error) {
    // Create a record of the failed email
    const sentEmail = new SentEmail({
      subject,
      body: "React component email", // We don't have the rendered HTML
      from,
      to,
      cc: cc || [],
      bcc: bcc || [],
      status: "failed",
      resendId: "error",
      metadata: new Map([["error", error.message]]),
    });

    await sentEmail.save();

    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data || !data.id) {
    throw new Error("Failed to send email: No ID returned from Resend");
  }

  // Log sent email
  const sentEmail = new SentEmail({
    subject,
    body: "React component email", // We don't have the rendered HTML
    from,
    to,
    cc: cc || [],
    bcc: bcc || [],
    resendId: data.id,
  });

  await sentEmail.save();

  return { id: data.id, sentEmail };
};

// Send custom email (without template)
export const sendCustomEmail = async ({
  subject,
  html,
  to,
  cc,
  bcc,
  from = process.env.DEFAULT_EMAIL_FROM || "SATX Ritas <orders@satxritas.com>",
}: {
  subject: string;
  html: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
}): Promise<{ id: string; sentEmail: ISentEmail }> => {
  await dbConnect();

  // Send email with Resend
  const { data, error } = await resend.emails.send({
    from,
    to,
    cc,
    bcc,
    subject,
    html,
  });

  if (error) {
    // Create a record of the failed email
    const sentEmail = new SentEmail({
      subject,
      body: html,
      from,
      to,
      cc: cc || [],
      bcc: bcc || [],
      status: "failed",
      resendId: "error",
      metadata: new Map([["error", error.message]]),
    });

    await sentEmail.save();

    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data || !data.id) {
    throw new Error("Failed to send email: No ID returned from Resend");
  }

  // Log sent email
  const sentEmail = new SentEmail({
    subject,
    body: html,
    from,
    to,
    cc: cc || [],
    bcc: bcc || [],
    resendId: data.id,
  });

  await sentEmail.save();

  return { id: data.id, sentEmail };
};

// Preview email template with variables
export const previewEmailTemplate = async ({
  templateId,
  variables,
}: {
  templateId: string;
  variables: Record<string, string>;
}): Promise<{ subject: string; body: string }> => {
  await dbConnect();

  // Get template
  const template = await EmailTemplate.findById(templateId);
  if (!template) {
    throw new Error(`Email template with ID ${templateId} not found`);
  }

  // Replace variables in subject and body
  const subject = replaceVariables(template.subject, variables);
  const body = replaceVariables(template.body, variables);

  return { subject, body };
};

// Get email template by ID
export const getEmailTemplate = async (id: string): Promise<IEmailTemplate> => {
  await dbConnect();

  const template = await EmailTemplate.findById(id);
  if (!template) {
    throw new Error(`Email template with ID ${id} not found`);
  }

  return template;
};

// Get all email templates
export const getAllEmailTemplates = async (): Promise<IEmailTemplate[]> => {
  await dbConnect();

  return EmailTemplate.find().sort({ name: 1 });
};

// Create email template
export const createEmailTemplate = async (
  template: Partial<IEmailTemplate>,
): Promise<IEmailTemplate> => {
  await dbConnect();

  const newTemplate = new EmailTemplate(template);
  await newTemplate.save();

  return newTemplate;
};

// Update email template
export const updateEmailTemplate = async (
  id: string,
  template: Partial<IEmailTemplate>,
): Promise<IEmailTemplate> => {
  await dbConnect();

  const updatedTemplate = await EmailTemplate.findByIdAndUpdate(
    id,
    { ...template, updatedAt: new Date() },
    { new: true, runValidators: true },
  );

  if (!updatedTemplate) {
    throw new Error(`Email template with ID ${id} not found`);
  }

  return updatedTemplate;
};

// Delete email template
export const deleteEmailTemplate = async (id: string): Promise<void> => {
  await dbConnect();

  const result = await EmailTemplate.findByIdAndDelete(id);

  if (!result) {
    throw new Error(`Email template with ID ${id} not found`);
  }
};

// Get sent emails with pagination
export const getSentEmails = async ({
  page = 1,
  limit = 10,
  status,
}: {
  page?: number;
  limit?: number;
  status?: "sent" | "failed" | "delivered" | "bounced";
}): Promise<{ emails: ISentEmail[]; total: number; pages: number }> => {
  await dbConnect();

  const query = status ? { status } : {};

  const [emails, total] = await Promise.all([
    SentEmail.find(query)
      .sort({ sentAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("templateId", "name"),
    SentEmail.countDocuments(query),
  ]);

  return {
    emails,
    total,
    pages: Math.ceil(total / limit),
  };
};

// Get sent email by ID
export const getSentEmail = async (id: string): Promise<ISentEmail> => {
  await dbConnect();

  const email = await SentEmail.findById(id).populate("templateId", "name");

  if (!email) {
    throw new Error(`Sent email with ID ${id} not found`);
  }

  return email;
};

// Update sent email status (e.g., from webhook)
export const updateSentEmailStatus = async (
  resendId: string,
  status: "sent" | "failed" | "delivered" | "bounced",
): Promise<ISentEmail> => {
  await dbConnect();

  const email = await SentEmail.findOneAndUpdate(
    { resendId },
    { status },
    { new: true },
  );

  if (!email) {
    throw new Error(`Sent email with Resend ID ${resendId} not found`);
  }

  return email;
};
