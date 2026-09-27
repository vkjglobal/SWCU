"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffMembership } from "@/lib/authorise";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import {
  documentStatuses,
  memberAudiences,
  noticeStatuses,
  requestStatuses,
  type MemberSummary,
} from "@/lib/member-app-admin-contract";
import { requireTenant } from "@/lib/tenant";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const idSchema = z.string().trim().min(1).max(200)
  .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/);
const requestStatusSchema = z.enum(requestStatuses);
const noticeStatusSchema = z.enum(noticeStatuses);
const documentStatusSchema = z.enum(documentStatuses);
const audienceSchema = z.enum(memberAudiences);
const requestUpdateSchema = z.object({
  id: idSchema,
  status: requestStatusSchema,
  memberMessage: z.string().max(10_000).optional(),
});
const internalNoteSchema = z.object({ id: idSchema, note: z.string().trim().min(1).max(10_000) });
const noticeSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(250),
  message: z.string().min(1).max(50_000),
  audience: audienceSchema,
  memberId: idSchema.optional(),
  showFrom: z.string().nullable().optional(),
  showUntil: z.string().nullable().optional(),
  status: noticeStatusSchema,
});
const documentSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(250),
  shortDescription: z.string().max(2_000),
  audience: audienceSchema,
  memberId: idSchema.optional(),
  documentType: z.string().trim().min(1).max(150),
  availableFrom: z.string().nullable().optional(),
  availableUntil: z.string().nullable().optional(),
  status: documentStatusSchema,
});

async function getAuthorizedClient() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { session, membership } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  if (!session.user?.id || membership.role !== "ADMINISTRATOR") {
    throw new Error("Administrator access is required.");
  }
  const client = await getMemberAppAdminClient(tenant, session.user.id);
  if (!client) throw new MemberAppServiceError("disconnected", "Member App service is not connected.");
  return client;
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") throw new Error("Invalid form input.");
  return value;
}

function readOptionalText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (value === null) return "";
  if (typeof value !== "string") throw new Error("Invalid form input.");
  return value;
}

function readOptionalDate(formData: FormData, key: string): string | null | undefined {
  const value = formData.get(key);
  if (value === null) return undefined;
  if (value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Invalid date.");
  }
  const parsed = new Date(value);
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    throw new Error("Invalid date.");
  }
  return parsed.toISOString();
}

function validateDateRange(start?: string | null, end?: string | null): void {
  if (start !== undefined && start !== null && end !== undefined && end !== null && Date.parse(end) < Date.parse(start)) {
    throw new Error("The end date must not be before the start date.");
  }
}

function readUpload(formData: FormData, required: boolean): File | undefined {
  const value = formData.get("file");
  if (value === null || (value instanceof File && value.name === "" && value.size === 0)) {
    if (required) throw new Error("A file is required.");
    return undefined;
  }
  if (!(value instanceof File) || !value.name.trim() || value.size < 1 || value.size > MAX_FILE_BYTES) {
    throw new Error("The selected file is invalid or too large.");
  }
  if (!ALLOWED_FILE_TYPES.has(value.type.toLowerCase())) {
    throw new Error("The selected file type is not supported.");
  }
  return value;
}

function revalidateMemberServicePages(detailPath?: string): void {
  revalidatePath("/admin/member-requests");
  revalidatePath("/admin/member-notices");
  revalidatePath("/admin/member-documents");
  if (detailPath) revalidatePath(detailPath);
}

function formFailure(error: unknown): { error: string } {
  if (error instanceof MemberAppServiceError && error.code === "disconnected") {
    return { error: "Member App service is not connected. Please contact support." };
  }
  return { error: "We could not save this change. Check the submitted details and try again." };
}

function isNextControlFlow(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "digest" in error &&
    (String(error.digest).startsWith("NEXT_REDIRECT") || String(error.digest).startsWith("NEXT_HTTP_ERROR_FALLBACK")),
  );
}

function checkedAudienceTarget(audience: string, memberId?: string) {
  const validatedAudience = audienceSchema.parse(audience);
  if (validatedAudience === "Individual Member") {
    if (!memberId) throw new Error("Choose a member for an individual audience.");
    return { audience: validatedAudience, memberId: idSchema.parse(memberId) };
  }
  return { audience: validatedAudience };
}

function checkedSignedAccessUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid attachment link.");
  }
  if (url.protocol !== "https:") throw new Error("Invalid attachment link.");

  const params = new Map<string, string>();
  url.searchParams.forEach((item, key) => params.set(key.toLowerCase(), item));
  const now = Date.now();
  let expiresAt: number | undefined;
  const signedAt = params.get("x-amz-date");
  const signedDuration = params.get("x-amz-expires");
  if (signedAt && signedDuration && /^\d+$/.test(signedDuration)) {
    const parsedSignedAt = Date.parse(`${signedAt.slice(0, 4)}-${signedAt.slice(4, 6)}-${signedAt.slice(6, 8)}T${signedAt.slice(9, 11)}:${signedAt.slice(11, 13)}:${signedAt.slice(13, 15)}Z`);
    expiresAt = parsedSignedAt + Number(signedDuration) * 1000;
  } else {
    const expiry = params.get("expiresat") ?? params.get("expires_at") ?? params.get("expires") ?? params.get("exp") ?? params.get("se");
    if (expiry) {
      const numeric = Number(expiry);
      expiresAt = Number.isFinite(numeric)
        ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric)
        : Date.parse(expiry);
    }
  }
  if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 15 * 60 * 1000) {
    throw new Error("Attachment link is not short-lived.");
  }
  return url.toString();
}

export async function updateMemberRequestAction(formData: FormData): Promise<void> {
  const client = await getAuthorizedClient();
  const changeMemberMessage = formData.get("changeMemberMessage") === "on";
  const values = requestUpdateSchema.parse({
    id: readText(formData, "id"),
    status: readText(formData, "status"),
    ...(changeMemberMessage ? { memberMessage: readText(formData, "memberMessage") } : {}),
  });
  await client.updateRequest(values.id, {
    status: values.status,
    ...(changeMemberMessage ? { memberMessage: values.memberMessage } : {}),
  });
  revalidateMemberServicePages(`/admin/member-requests/${encodeURIComponent(values.id)}`);
  redirect(`/admin/member-requests/${encodeURIComponent(values.id)}`);
}

export async function searchMemberTargetsAction(query: string): Promise<MemberSummary[]> {
  const client = await getAuthorizedClient();
  const parsedQuery = z.string().trim().min(2).max(80).safeParse(query);
  if (!parsedQuery.success) {
    throw new Error("Enter between 2 and 80 characters to search members.");
  }
  try {
    return await client.searchMembers(parsedQuery.data);
  } catch {
    throw new Error("Member search is unavailable. Please try again.");
  }
}

export async function addMemberInternalNoteAction(formData: FormData): Promise<void> {
  const client = await getAuthorizedClient();
  const values = internalNoteSchema.parse({
    id: readText(formData, "id"),
    note: readText(formData, "note"),
  });
  await client.addInternalNote(values.id, values.note);
  revalidateMemberServicePages(`/admin/member-requests/${encodeURIComponent(values.id)}`);
  redirect(`/admin/member-requests/${encodeURIComponent(values.id)}`);
}

export async function openMemberAttachmentAction(formData: FormData): Promise<void> {
  const client = await getAuthorizedClient();
  const requestId = idSchema.parse(readText(formData, "requestId"));
  const attachmentId = idSchema.parse(readText(formData, "attachmentId"));
  const accessUrl = checkedSignedAccessUrl(await client.getAttachmentAccess(requestId, attachmentId));
  redirect(accessUrl);
}

export async function saveMemberNoticeAction(
  _previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const client = await getAuthorizedClient();
    const id = readOptionalText(formData, "id");
    const target = checkedAudienceTarget(readText(formData, "audience"), readText(formData, "memberId") || undefined);
    const showFrom = readOptionalDate(formData, "showFrom");
    const showUntil = readOptionalDate(formData, "showUntil");
    const values = noticeSchema.parse({
      ...(id ? { id } : {}),
      title: readText(formData, "title"),
      message: readText(formData, "message"),
      ...target,
      ...(showFrom !== undefined ? { showFrom } : {}),
      ...(showUntil !== undefined ? { showUntil } : {}),
      status: readText(formData, "status"),
    });
    validateDateRange(values.showFrom, values.showUntil);
    const file = readUpload(formData, false);
    const payload = {
      title: values.title,
      message: values.message,
      audience: values.audience,
      ...(values.memberId ? { memberId: values.memberId } : {}),
      ...(values.showFrom !== undefined ? { showFrom: values.showFrom } : {}),
      ...(values.showUntil !== undefined ? { showUntil: values.showUntil } : {}),
      status: values.status,
      ...(file ? { attachment: file } : {}),
    };
    const saved = values.id
      ? await client.updateNotice(values.id, payload)
      : await client.createNotice(payload);
    revalidateMemberServicePages(`/admin/member-notices/${encodeURIComponent(saved.id)}`);
    redirect("/admin/member-notices");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return formFailure(error);
  }
}

export async function saveMemberDocumentAction(
  _previous: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const client = await getAuthorizedClient();
    const id = readOptionalText(formData, "id");
    const target = checkedAudienceTarget(readText(formData, "audience"), readText(formData, "memberId") || undefined);
    const availableFrom = readOptionalDate(formData, "availableFrom");
    const availableUntil = readOptionalDate(formData, "availableUntil");
    const values = documentSchema.parse({
      ...(id ? { id } : {}),
      title: readText(formData, "title"),
      shortDescription: readText(formData, "shortDescription"),
      ...target,
      documentType: readText(formData, "documentType"),
      ...(availableFrom !== undefined ? { availableFrom } : {}),
      ...(availableUntil !== undefined ? { availableUntil } : {}),
      status: readText(formData, "status"),
    });
    validateDateRange(values.availableFrom, values.availableUntil);
    const file = readUpload(formData, !values.id);
    const payload = {
      title: values.title,
      shortDescription: values.shortDescription,
      audience: values.audience,
      ...(values.memberId ? { memberId: values.memberId } : {}),
      documentType: values.documentType,
      ...(values.availableFrom !== undefined ? { availableFrom: values.availableFrom } : {}),
      ...(values.availableUntil !== undefined ? { availableUntil: values.availableUntil } : {}),
      status: values.status,
    };
    const saved = values.id
      ? await client.updateDocument(values.id, payload, file)
      : await client.createDocument(payload, file!);
    revalidateMemberServicePages(`/admin/member-documents/${encodeURIComponent(saved.id)}`);
    redirect("/admin/member-documents");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return formFailure(error);
  }
}