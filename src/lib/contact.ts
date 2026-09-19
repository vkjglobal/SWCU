import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import type { ResolvedTenant } from "@/lib/tenant";
import { hasPublishedPrivacy } from "@/lib/public-data";

export const CONTACT_SUBJECTS = [
  "Membership", "Loans", "Savings", "Forms & Documents",
  "Request a Call Back", "General Enquiry", "Other",
] as const;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(""),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(0).max(4000),
  privacyAcknowledged: z.literal(true),
  website: z.string().max(0).optional().default(""),
}).superRefine((value, context) => {
  if (value.subject !== "Request a Call Back" && value.message.length < 5) context.addIssue({ code: "custom", path: ["message"], message: "Please provide at least 5 characters." });
});

export type ContactInput = z.input<typeof contactSchema>;

export type ContactNotificationStatus = "SKIPPED_NO_RECIPIENT" | "SKIPPED_NO_PROVIDER" | "SENT" | "FAILED";
export const contactRecipientsSchema = z.preprocess(
  (raw) => Array.isArray(raw) ? raw : String(raw ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  z.array(z.string().email().max(160)),
);
export function parseContactRecipientsForm(form: FormData) {
  return contactRecipientsSchema.parse(form.get("notificationRecipients")?.toString() ?? "");
}

export async function handleContactPost(tenant: ResolvedTenant, body: unknown, ipAddress: string) {
  if (!body || typeof body !== "object") throw new Error("Invalid request.");
  return submitContactEnquiry({ tenant, value: body as ContactInput, ipAddress });
}

export async function updateContactStatus(input: { tenant: ResolvedTenant; actorUserId: string; id: string; status: "NEW" | "BEING_HANDLED" | "CLOSED"; note: string }) {
  return db.$transaction(async (tx) => {
    const enquiry = await tx.contactSubmission.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenant.id } });
    const updated = await tx.contactSubmission.update({ where: { id: enquiry.id }, data: { status: input.status, internalNote: input.note || null, handledAt: input.status === "BEING_HANDLED" ? new Date() : enquiry.handledAt, closedAt: input.status === "CLOSED" ? new Date() : null } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: input.status === "CLOSED" ? "CONTACT_ENQUIRY_CLOSED" : "CONTACT_ENQUIRY_UPDATED", targetType: "ContactSubmission", targetId: enquiry.reference, changeMetadata: { status: input.status, noteAdded: Boolean(input.note) } } });
    return updated;
  });
}

export async function openContactEnquiry(input: { tenant: ResolvedTenant; actorUserId: string; id: string }) {
  return db.$transaction(async (tx) => {
    const enquiry = await tx.contactSubmission.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenant.id } });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${enquiry.id}, 0))`;
    const updatedCount = await tx.contactSubmission.updateMany({ where: { id: enquiry.id, tenantId: input.tenant.id, viewedAt: null }, data: { viewedAt: new Date() } });
    if (updatedCount.count === 0) return enquiry;
    const updated = await tx.contactSubmission.findUniqueOrThrow({ where: { id: enquiry.id } });
    await tx.auditLog.create({ data: { tenantId: input.tenant.id, actorUserId: input.actorUserId, action: "CONTACT_ENQUIRY_VIEWED", targetType: "ContactSubmission", targetId: enquiry.reference, changeMetadata: {} } });
    return updated;
  });
}

function keyFor(tenantId: string, ip: string) {
  return `${tenantId}:${ip || "unknown"}`;
}

async function takeContactRateLimit(tenantId: string, ip: string) {
  const now = new Date();
  const windowMs = 15 * 60 * 1000;
  const blockedMs = 15 * 60 * 1000;
  return db.$transaction(async (tx) => {
    const key = keyFor(tenantId, ip);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const previous = await tx.contactRateLimit.findUnique({ where: { key } });
    if (previous?.blockedUntil && previous.blockedUntil > now) return false;
    const inWindow = previous && now.getTime() - previous.windowStart.getTime() < windowMs;
    const attempts = inWindow ? previous.attempts + 1 : 1;
    await tx.contactRateLimit.upsert({
      where: { key },
      update: {
        attempts,
        windowStart: inWindow ? previous.windowStart : now,
        blockedUntil: attempts >= 5 ? new Date(now.getTime() + blockedMs) : null,
      },
      create: { key, tenantId, ipAddress: ip || null, attempts, windowStart: now, blockedUntil: attempts >= 5 ? new Date(now.getTime() + blockedMs) : null },
    });
    return attempts <= 5;
  });
}

export async function submitContactEnquiry(input: {
  tenant: ResolvedTenant;
  value: ContactInput;
  ipAddress?: string;
}) {
  const parsed = contactSchema.safeParse(input.value);
  if (!parsed.success) throw new Error("Please check the highlighted contact form fields.");
  if (parsed.data.subject === "Request a Call Back" && !parsed.data.phone.trim()) {
    throw new Error("A phone number is required for a call back request.");
  }
  if (!(await hasPublishedPrivacy(input.tenant))) {
    throw new Error("Contact enquiries are temporarily unavailable until the published Privacy information is ready.");
  }
  if (!(await takeContactRateLimit(input.tenant.id, input.ipAddress ?? ""))) {
    throw new Error("Please wait before sending another enquiry.");
  }

  const submission = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenant.id}, 0))`;
    const count = await tx.contactSubmission.count({ where: { tenantId: input.tenant.id } });
    const reference = `SWCU-C-${String(count + 1).padStart(4, "0")}`;
    const created = await tx.contactSubmission.create({
      data: {
        tenantId: input.tenant.id,
        reference,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        subject: parsed.data.subject,
        message: parsed.data.message,
      },
      select: { reference: true, subject: true },
    });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenant.id,
        action: "CONTACT_ENQUIRY_RECEIVED",
        targetType: "ContactSubmission",
        targetId: reference,
        changeMetadata: { subject: created.subject },
      },
    });
    return created;
  });

  const settings = await db.contactSettings.findUnique({ where: { tenantId: input.tenant.id }, select: { notificationRecipients: true } });
  const notification = await notifyContact({
    recipients: Array.isArray(settings?.notificationRecipients) ? settings.notificationRecipients.filter((item): item is string => typeof item === "string") : [],
    reference: submission.reference,
    subject: submission.subject,
  });
  return {
    reference: submission.reference,
    notification,
  };
}

export async function notifyContact(input: { recipients: string[]; reference: string; subject: string }): Promise<{ status: ContactNotificationStatus; message: string }> {
  const message = `New SWCU website enquiry received. Reference: ${input.reference} Subject: ${input.subject} Log in to the SWCU Admin portal to review.`;
  if (input.recipients.length === 0) return { status: "SKIPPED_NO_RECIPIENT", message };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_EMAIL_FROM;
  if (!apiKey || !from) return { status: "SKIPPED_NO_PROVIDER", message };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.recipients, subject: `SWCU enquiry ${input.reference}`, text: message }),
    });
    if (!response.ok) return { status: "FAILED", message };
    return { status: "SENT", message };
  } catch {
    return { status: "FAILED", message };
  }
}

export async function listContactEnquiries(tenant: ResolvedTenant) {
  return db.contactSubmission.findMany({
    where: { tenantId: tenant.id },
    orderBy: { submittedAt: "desc" },
  });
}