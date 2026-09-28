"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffMembership } from "@/lib/authorise";
import { getMemberAppAdminClient, MemberAppServiceError } from "@/lib/member-app-admin";
import { fijiLocalDateTimeToUtcIso } from "@/lib/fiji-time";
import {
  documentStatuses,
  memberAudiences,
  noticeStatuses,
  requestStatuses,
  type MemberSummary,
} from "@/lib/member-app-admin-contract";
import { changedMemberMessage } from "@/lib/member-services-request-message";
import { requireTenant } from "@/lib/tenant";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const idSchema = z.string().trim().min(1).max(200)
  .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/);
const requestStatusSchema = z.enum(requestStatuses);
const noticeStatusSchema = z.enum(noticeStatuses);
const documentStatusSchema = z.enum(documentStatuses);
const audienceSchema = z.enum(memberAudiences);
const requestUpdateSchema = z.object({
  id: idSchema,
  status: requestStatusSchema.optional(),
  memberMessage: z.string().max(2_000).nullable().optional(),
});
const internalNoteSchema = z.object({ id: idSchema, note: z.string().trim().min(1).max(4_000) });
const noticeSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(250),
  message: z.string().min(1).max(50_000),
  audience: audienceSchema,
  memberId: idSchema.nullable().optional(),
  showFrom: z.string().nullable().optional(),
  showUntil: z.string().nullable().optional(),
  status: noticeStatusSchema,
});
const documentSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(250),
  shortDescription: z.string().max(2_000),
  audience: audienceSchema,
  memberId: idSchema.nullable().optional(),
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
  if (typeof value !== "string") throw new Error("Invalid date.");
  try {
    return fijiLocalDateTimeToUtcIso(value);
  } catch {
    throw new Error("Enter a valid date and time in Fiji time.");
  }
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
  if (error instanceof z.ZodError) return { error: "Check the submitted details and try again." };
  if (error instanceof Error && error.message === "Choose a member for an individual audience.") return { error: error.message };
  if (error instanceof Error && error.message === "A file is not supported for metadata-only edits.") return { error: error.message };
  if (error instanceof Error && error.message === "Enter a valid date and time in Fiji time.") return { error: error.message };
  return { error: "We could not save this change. Please try again." };
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
  return { audience: validatedAudience, memberId: null };
}

export async function updateMemberRequestAction(_previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const client = await getAuthorizedClient();
    const selectedStatus = readOptionalText(formData, "status");
    const initialStatus = readOptionalText(formData, "initialStatus");
    const status = selectedStatus && selectedStatus !== initialStatus ? selectedStatus : "";
    const memberMessage = changedMemberMessage(
      readText(formData, "initialMemberMessage"),
      readText(formData, "memberMessage"),
    );
    const values = requestUpdateSchema.parse({
      id: readText(formData, "id"),
      ...(status ? { status } : {}),
      ...(memberMessage !== undefined ? { memberMessage } : {}),
    });
    if (!values.status && values.memberMessage === undefined) return { error: "Make a status or member-message change before saving." };
    const saved = await client.updateRequest(values.id, {
      ...(values.status ? { status: values.status } : {}),
      ...(values.memberMessage !== undefined ? { memberMessage: values.memberMessage } : {}),
    });
    if (values.memberMessage !== undefined && saved.memberMessage !== values.memberMessage) {
      revalidateMemberServicePages(`/admin/member-requests/${encodeURIComponent(values.id)}`);
      return { error: "The member message was not confirmed. Refresh and try again." };
    }
    revalidateMemberServicePages(`/admin/member-requests/${encodeURIComponent(values.id)}`);
    redirect(`/admin/member-requests/${encodeURIComponent(values.id)}?updated=1`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return formFailure(error);
  }
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

export async function addMemberInternalNoteAction(_previous: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const client = await getAuthorizedClient();
    const values = internalNoteSchema.parse({
      id: readText(formData, "id"),
      note: readText(formData, "note"),
    });
    await client.addInternalNote(values.id, values.note);
    revalidateMemberServicePages(`/admin/member-requests/${encodeURIComponent(values.id)}`);
    redirect(`/admin/member-requests/${encodeURIComponent(values.id)}?noted=1`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return formFailure(error);
  }
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
    const submittedFile = formData.get("file");
    if (id && submittedFile !== null) throw new Error("A file is not supported for metadata-only edits.");
    const file = id ? undefined : readUpload(formData, false);
    const payload = {
      title: values.title,
      message: values.message,
      audience: values.audience,
       ...(values.memberId !== undefined ? { memberId: values.memberId } : {}),
      ...(values.showFrom !== undefined ? { showFrom: values.showFrom } : {}),
      ...(values.showUntil !== undefined ? { showUntil: values.showUntil } : {}),
      status: values.status,
       ...(!values.id && file ? { attachment: file } : {}),
    };
    const saved = values.id
      ? await client.updateNotice(values.id, payload)
      : await client.createNotice(payload);
    revalidateMemberServicePages(`/admin/member-notices/${encodeURIComponent(saved.id)}`);
    redirect(values.id
      ? `/admin/member-notices/${encodeURIComponent(saved.id)}?saved=1`
      : "/admin/member-notices");
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
    const submittedFile = formData.get("file");
    if (values.id && submittedFile !== null) throw new Error("A file is not supported for metadata-only edits.");
    const file = values.id ? undefined : readUpload(formData, true);
    const payload = {
      title: values.title,
      shortDescription: values.shortDescription,
      audience: values.audience,
      ...(values.memberId !== undefined ? { memberId: values.memberId } : {}),
      documentType: values.documentType,
      ...(values.availableFrom !== undefined ? { availableFrom: values.availableFrom } : {}),
      ...(values.availableUntil !== undefined ? { availableUntil: values.availableUntil } : {}),
      status: values.status,
    };
    const saved = values.id
      ? await client.updateDocument(values.id, payload)
      : await client.createDocument(payload, file!);
    revalidateMemberServicePages(`/admin/member-documents/${encodeURIComponent(saved.id)}`);
    redirect(values.id
      ? `/admin/member-documents/${encodeURIComponent(saved.id)}?saved=1`
      : "/admin/member-documents");
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return formFailure(error);
  }
}