import "server-only";

import { z } from "zod";
import type { ResolvedTenant } from "@/lib/tenant";
import { getServerEnvironment } from "@/lib/env";
import {
  memberAppResponseSchemas,
  memberAudiences,
  noticeStatuses,
  documentStatuses,
  requestStatuses,
  type ApiDocument,
  type ApiNotice,
  type ApiRequestDetail,
  type ApiRequestListItem,
  type MemberDocument,
  type MemberDocumentData,
  type MemberDocumentFilters,
  type MemberInternalNote,
  type MemberNotice,
  type MemberNoticeData,
  type MemberNoticeFilters,
  type MemberRequestDetail,
  type MemberRequestSummary,
  type MemberRequestUpdate,
  type MemberSummary,
  type PageResult,
  type RequestFilters,
  type RequestStatus,
} from "@/lib/member-app-admin-contract";

export { requestStatuses, noticeStatuses, documentStatuses, memberAudiences };
export type {
  DocumentStatus,
  MemberAudience,
  MemberDocument,
  MemberDocumentData,
  MemberDocumentFilters,
  MemberInternalNote,
  MemberNotice,
  MemberNoticeData,
  MemberNoticeFilters,
  MemberRequestDetail,
  MemberRequestSummary,
  MemberRequestUpdate,
  MemberSummary,
  NoticeStatus,
  PageResult,
  RequestFilters,
  RequestStatus,
} from "@/lib/member-app-admin-contract";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedFileTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const identifierSchema = z.string().trim().min(1).max(200)
  .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/);
const optionalDateField = z.union([z.string().date(), z.string().datetime()]).nullable();
const requestStatusSchema = z.enum(requestStatuses);
const noticeStatusSchema = z.enum(noticeStatuses);
const documentStatusSchema = z.enum(documentStatuses);
const audienceSchema = z.enum(memberAudiences);
const requestUpdateSchema = z.object({
  status: requestStatusSchema.optional(),
  memberMessage: z.string().max(2_000).nullable().optional(),
}).strict().refine((value) => value.status !== undefined || value.memberMessage !== undefined);
const noticeFields = {
  title: z.string().trim().min(1).max(250),
  message: z.string().min(1).max(50_000),
  audience: audienceSchema,
  memberId: identifierSchema.nullable().optional(),
  showFrom: optionalDateField.optional(),
  showUntil: optionalDateField.optional(),
  status: noticeStatusSchema.optional(),
};
const noticeCreateSchema = z.object(noticeFields).strict().refine(
  (value) => value.audience === "Individual Member" ? Boolean(value.memberId) : !value.memberId,
  "Select a member only for an individual-member audience.",
);
const noticePatchSchema = z.object({
  title: noticeFields.title.optional(),
  message: noticeFields.message.optional(),
  audience: audienceSchema.optional(),
  memberId: identifierSchema.nullable().optional(),
  showFrom: optionalDateField.optional(),
  showUntil: optionalDateField.optional(),
  status: noticeStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const documentFields = {
  title: z.string().trim().min(1).max(250),
  shortDescription: z.string().max(2_000),
  audience: audienceSchema,
  memberId: identifierSchema.nullable().optional(),
  documentType: z.string().trim().min(1).max(150),
  availableFrom: optionalDateField.optional(),
  availableUntil: optionalDateField.optional(),
  status: documentStatusSchema.optional(),
};
const documentCreateSchema = z.object(documentFields).strict().refine(
  (value) => value.audience === "Individual Member" ? Boolean(value.memberId) : !value.memberId,
  "Select a member only for an individual-member audience.",
);
const documentPatchSchema = z.object({
  title: documentFields.title.optional(),
  shortDescription: documentFields.shortDescription.optional(),
  audience: audienceSchema.optional(),
  memberId: identifierSchema.nullable().optional(),
  documentType: documentFields.documentType.optional(),
  availableFrom: optionalDateField.optional(),
  availableUntil: optionalDateField.optional(),
  status: documentStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const pageInteger = z.number().int().positive();
const listFiltersSchema = z.object({
  page: pageInteger.optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
}).strict();

export class MemberAppServiceError extends Error {
  readonly code: "disconnected" | "invalid_configuration" | "timeout" | "network" | "http" | "invalid_response" | "validation";
  readonly status?: number;

  constructor(code: MemberAppServiceError["code"], message: string, status?: number) {
    super(message);
    this.name = "MemberAppServiceError";
    this.code = code;
    this.status = status;
  }
}

export type MemberAppAdminClient = {
  listRequests(filters?: RequestFilters): Promise<PageResult<MemberRequestSummary, "requests">>;
  getRequest(id: string): Promise<MemberRequestDetail>;
  updateRequest(id: string, data: { status?: RequestStatus; memberMessage?: string | null }): Promise<MemberRequestUpdate>;
  addInternalNote(id: string, note: string): Promise<MemberInternalNote>;
  getRequestAttachmentStream(id: string, attachmentId: string): Promise<Response>;
  listNotices(filters?: MemberNoticeFilters): Promise<PageResult<MemberNotice, "notices">>;
  getNotice(id: string): Promise<MemberNotice>;
  createNotice(data: MemberNoticeData): Promise<MemberNotice>;
  updateNotice(id: string, data: Partial<Omit<MemberNoticeData, "attachment">>): Promise<MemberNotice>;
  getNoticeAttachmentStream(id: string): Promise<Response>;
  searchMembers(query: string): Promise<MemberSummary[]>;
  listDocuments(filters?: MemberDocumentFilters): Promise<PageResult<MemberDocument, "documents">>;
  getDocument(id: string): Promise<MemberDocument>;
  createDocument(data: MemberDocumentData, file: File): Promise<MemberDocument>;
  updateDocument(id: string, data: Partial<MemberDocumentData>): Promise<MemberDocument>;
  getDocumentFileStream(id: string): Promise<Response>;
};

export type MemberAppAdminClientConfig = {
  baseUrl?: string;
  serviceKey?: string;
  /** An audit label from trusted server-side staff context, never authentication. */
  actorUserId?: string;
  timeoutMs?: number;
};

type FetchImplementation = typeof fetch;

function validateIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw new MemberAppServiceError("validation", "A valid record identifier is required.");
  return result.data;
}

function itemPath(collection: string, id: string): string {
  return `${collection}/${encodeURIComponent(validateIdentifier(id))}`;
}

export const memberAppAdminEndpoints = {
  requests: "/member-admin/requests",
  request: (id: string) => itemPath("/member-admin/requests", id),
  requestStatus: (id: string) => `${itemPath("/member-admin/requests", id)}/status`,
  requestInternalNotes: (id: string) => `${itemPath("/member-admin/requests", id)}/internal-notes`,
  requestAttachment: (id: string, attachmentId: string) =>
    `${itemPath("/member-admin/requests", id)}/attachments/${encodeURIComponent(validateIdentifier(attachmentId))}`,
  notices: "/member-admin/notices",
  notice: (id: string) => itemPath("/member-admin/notices", id),
  noticeAttachment: (id: string) => `${itemPath("/member-admin/notices", id)}/attachment`,
  members: "/member-admin/members",
  documents: "/member-admin/documents",
  document: (id: string) => itemPath("/member-admin/documents", id),
  documentFile: (id: string) => `${itemPath("/member-admin/documents", id)}/file`,
} as const;

function apiUrl(origin: string, path: string, query?: URLSearchParams): URL {
  const url = new URL(path, origin);
  if (query) url.search = query.toString();
  return url;
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new MemberAppServiceError("validation", "The submitted Member App data is not valid.");
  return parsed.data;
}

function memberFromApi(member: {
  id: string; number?: string; memberNumber?: string; fullName?: string; name?: string;
  membershipStatus?: string | null; status?: string | null; email?: string | null; mobile?: string | null;
}): MemberSummary {
  const number = member.number ?? member.memberNumber ?? "";
  return {
    id: member.id,
    name: member.fullName ?? member.name ?? "",
    identifier: number,
    ...(member.memberNumber ?? member.number ? { memberNumber: member.memberNumber ?? member.number } : {}),
    ...(member.membershipStatus ?? member.status ? { membershipStatus: member.membershipStatus ?? member.status ?? undefined } : {}),
    ...(member.email !== undefined ? { email: member.email } : {}),
    ...(member.mobile !== undefined ? { mobile: member.mobile } : {}),
  };
}

function requestSummaryFromApi(item: ApiRequestDetail | ApiRequestListItem): MemberRequestSummary {
  return {
    id: item.id,
    reference: item.reference,
    member: memberFromApi(item.member),
    type: item.formName,
    formCode: item.formCode,
    submittedAt: item.submittedAt,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}

function attachmentFromApi(item: {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
  createdAt?: string;
  responseId?: string | null;
}) {
  return {
    id: item.id,
    name: item.name,
    ...(item.size !== undefined ? { size: item.size } : {}),
    ...(item.contentType !== undefined ? { contentType: item.contentType } : {}),
    ...(item.createdAt !== undefined ? { createdAt: item.createdAt } : {}),
    ...(item.responseId !== undefined ? { responseId: item.responseId } : {}),
  };
}

function requestDetailFromApi(item: ApiRequestDetail): MemberRequestDetail {
  const orderedFields = item.fields.map(({ key, label, value }) => ({ key, label, value }));
  const fields = Object.fromEntries(orderedFields.map(({ label, value }) => [label, value]));
  const audit = item.activities;
  return {
    ...requestSummaryFromApi(item),
    fields,
    orderedFields,
    confirmation: item.confirmation,
    formVersion: item.formVersion,
    attachments: item.attachments.map(attachmentFromApi),
    memberMessage: item.memberMessage,
    internalNotes: item.internalNotes.map((note) => ({
      id: note.id,
      text: note.note,
      createdAt: note.createdAt,
      author: note.actor,
    })),
    history: audit.map((event) => ({
      id: event.id,
      description: [event.eventType, event.message, event.status].filter(Boolean).join(" · "),
      createdAt: event.createdAt,
      actor: event.actorId ?? event.actorType,
    })),
    responses: item.responses.map((response) => ({
      id: response.id,
      message: response.message ?? null,
      createdAt: response.createdAt,
      memberId: response.memberId,
      attachments: response.attachments.map(attachmentFromApi),
    })),
  };
}

function noticeFromApi(notice: ApiNotice): MemberNotice {
  return {
    id: notice.id,
    title: notice.title,
    message: notice.message,
    preview: notice.preview,
    audience: notice.audience,
    member: notice.targetMember ? memberFromApi(notice.targetMember) : null,
    attachment: notice.attachment,
    showFrom: notice.showFrom,
    showUntil: notice.showUntil,
    status: notice.status,
    storedStatus: notice.storedStatus,
    createdAt: notice.createdAt,
    updatedAt: notice.updatedAt,
    hasAttachment: notice.hasAttachment,
  };
}

function documentFromApi(document: ApiDocument): MemberDocument {
  return {
    id: document.id,
    title: document.title,
    shortDescription: document.description,
    audience: document.audience,
    member: document.targetMember ? memberFromApi(document.targetMember) : null,
    documentType: document.documentType,
    file: { name: document.fileName, size: document.fileSize, contentType: document.contentType },
    availableFrom: document.availableFrom,
    availableUntil: document.availableUntil,
    status: document.status,
    storedStatus: document.storedStatus,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toNoticePayload(data: Partial<Omit<MemberNoticeData, "attachment">>): Record<string, unknown> {
  const { memberId, ...rest } = data;
  return { ...rest, ...(memberId !== undefined ? { targetMemberId: memberId } : {}) };
}

function toDocumentPayload(data: Partial<MemberDocumentData>): Record<string, unknown> {
  const { memberId, shortDescription, ...rest } = data;
  return {
    ...rest,
    ...(shortDescription !== undefined ? { description: shortDescription } : {}),
    ...(memberId !== undefined ? { targetMemberId: memberId } : {}),
  };
}

function validateFile(file: File | undefined, required: boolean): void {
  if (!file && required) throw new MemberAppServiceError("validation", "A document file is required.");
  if (!file) return;
  if (typeof file.name !== "string" || !file.name.trim() || typeof file.size !== "number" || file.size <= 0) {
    throw new MemberAppServiceError("validation", "The selected file is not valid.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new MemberAppServiceError("validation", "Files must be 10 MiB or smaller.");
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const expectedType = allowedFileTypes[extension];
  if (!expectedType || file.type.toLowerCase() !== expectedType) {
    throw new MemberAppServiceError("validation", "Use a PDF, JPEG, PNG, or WebP file with a matching file type.");
  }
}

function validateStream(response: Response): Response {
  if (!response.ok) {
    throw new MemberAppServiceError("http", "Member App service could not complete the request.", response.status);
  }
  const headers = response.headers;
  const contentType = headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const disposition = headers.get("content-disposition");
  const cacheControl = headers.get("cache-control")?.toLowerCase() ?? "";
  const nosniff = headers.get("x-content-type-options")?.toLowerCase();
  let filename: string | null = null;
  if (disposition) {
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const regular = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    try {
      filename = encoded ? decodeURIComponent(encoded) : regular ?? null;
    } catch {
      filename = null;
    }
  }
  const safeFilename = Boolean(filename && filename.trim() && !/[\/\\\u0000-\u001f\u007f]/.test(filename));
  if (
    !contentType || !Object.values(allowedFileTypes).includes(contentType)
    || !disposition?.toLowerCase().startsWith("attachment")
    || !safeFilename
    || !cacheControl.includes("private") || !cacheControl.includes("no-store")
    || nosniff !== "nosniff"
  ) {
    throw new MemberAppServiceError("invalid_response", "Member App service returned an invalid file response.");
  }
  return response;
}

export function createMemberAppAdminClient(
  config: MemberAppAdminClientConfig,
  fetchImpl: FetchImplementation = fetch,
): MemberAppAdminClient | null {
  if (!config.baseUrl || !config.serviceKey) return null;
  let parsedBase: URL;
  try {
    parsedBase = new URL(config.baseUrl);
  } catch {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }
  if (parsedBase.protocol !== "https:" || parsedBase.username || parsedBase.password || !config.serviceKey.trim()) {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }
  const actor = config.actorUserId
    ? identifierSchema.safeParse(config.actorUserId)
    : null;
  if (config.actorUserId && !actor?.success) {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }
  const actorLabel = actor?.success ? actor.data : undefined;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }
  const origin = parsedBase.origin;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { method?: string; body?: BodyInit; contentType?: string; query?: URLSearchParams; stream?: boolean } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers({ authorization: `Bearer ${config.serviceKey}`, accept: options.stream ? "*/*" : "application/json" });
    if (actorLabel) headers.set("x-admin-actor", actorLabel);
    if (options.contentType) headers.set("content-type", options.contentType);
    try {
      let response: Response;
      try {
        response = await fetchImpl(apiUrl(origin, path, options.query), {
          method: options.method ?? "GET",
          headers,
          body: options.body,
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (controller.signal.aborted) {
          throw new MemberAppServiceError("timeout", "Member App service request timed out.");
        }
        throw new MemberAppServiceError("network", "Member App service could not be reached.");
      }
      if (options.stream) return validateStream(response) as T;
      if (!response.ok) {
        throw new MemberAppServiceError("http", "Member App service could not complete the request.", response.status);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MemberAppServiceError("invalid_response", "Member App service returned an invalid response.");
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new MemberAppServiceError("invalid_response", "Member App service returned an invalid response.");
      }
      return parsed.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function jsonBody(value: unknown): { body: string; contentType: string } {
    return { body: JSON.stringify(value), contentType: "application/json" };
  }
  function multipartBody(field: "notice" | "document", data: unknown, file?: File): FormData {
    const form = new FormData();
    form.set(field, JSON.stringify(data));
    if (file) form.set("file", file, file.name);
    return form;
  }
  function paginationQuery(filters: unknown): URLSearchParams {
    const valid = parseInput(listFiltersSchema, {
      page: (filters as { page?: number } | undefined)?.page,
      pageSize: (filters as { pageSize?: number } | undefined)?.pageSize,
    });
    const query = new URLSearchParams();
    if (valid.page !== undefined) query.set("page", String(valid.page));
    if (valid.pageSize !== undefined) query.set("pageSize", String(valid.pageSize));
    return query;
  }

  return {
    async listRequests(filters = {}) {
      const query = paginationQuery(filters);
      const parsedFilters = parseInput(z.object({
        status: requestStatusSchema.optional(),
        formCode: z.string().trim().min(1).max(100).optional(),
        search: z.string().trim().max(120).optional(),
        page: pageInteger.optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }).strict(), filters);
      if (parsedFilters.status) query.set("status", parsedFilters.status);
      if (parsedFilters.formCode) query.set("formCode", parsedFilters.formCode);
      if (parsedFilters.search) query.set("search", parsedFilters.search);
      const result = await request(memberAppAdminEndpoints.requests, memberAppResponseSchemas.requestList, { query });
      return {
        requests: result.requests.map(requestSummaryFromApi),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
    async getRequest(id) {
      const result = await request(memberAppAdminEndpoints.request(id), memberAppResponseSchemas.requestDetail);
      return requestDetailFromApi(result.request);
    },
    async updateRequest(id, data) {
      const valid = parseInput(requestUpdateSchema, data);
      const body = jsonBody(valid);
      const result = await request(memberAppAdminEndpoints.requestStatus(id), memberAppResponseSchemas.requestMutation, {
        method: "PATCH", ...body,
      });
      return result.request;
    },
    async addInternalNote(id, note) {
      const validNote = parseInput(z.string().trim().min(1).max(4_000), note);
      const result = await request(memberAppAdminEndpoints.requestInternalNotes(id), memberAppResponseSchemas.internalNote, {
        method: "POST", ...jsonBody({ note: validNote }),
      });
      return result.note;
    },
    getRequestAttachmentStream(id, attachmentId) {
      return request(memberAppAdminEndpoints.requestAttachment(id, attachmentId), z.custom<Response>(), { stream: true });
    },
    async listNotices(filters = {}) {
      const query = paginationQuery(filters);
      const valid = parseInput(z.object({
        status: noticeStatusSchema.optional(),
        audience: audienceSchema.optional(),
        search: z.string().trim().max(120).optional(),
        page: pageInteger.optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }).strict(), filters);
      if (valid.status) query.set("status", valid.status);
      if (valid.audience) query.set("audience", valid.audience);
      if (valid.search) query.set("search", valid.search);
      const result = await request(memberAppAdminEndpoints.notices, memberAppResponseSchemas.notices, { query });
      return {
        notices: result.notices.map(noticeFromApi),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
    async getNotice(id) {
      const result = await request(memberAppAdminEndpoints.notice(id), memberAppResponseSchemas.notice);
      return noticeFromApi(result.notice);
    },
    async createNotice(data) {
      const file = data.attachment ?? undefined;
      validateFile(file, false);
      const valid = parseInput(noticeCreateSchema, {
        title: data.title,
        message: data.message,
        audience: data.audience,
        ...(data.memberId !== undefined ? { memberId: data.memberId } : {}),
        ...(data.showFrom !== undefined ? { showFrom: data.showFrom } : {}),
        ...(data.showUntil !== undefined ? { showUntil: data.showUntil } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      });
      const payload = toNoticePayload(valid);
      const result = file
        ? await request(memberAppAdminEndpoints.notices, memberAppResponseSchemas.notice, {
          method: "POST", body: multipartBody("notice", payload, file),
        })
        : await request(memberAppAdminEndpoints.notices, memberAppResponseSchemas.notice, {
          method: "POST", ...jsonBody(payload),
        });
      return noticeFromApi(result.notice);
    },
    async updateNotice(id, data) {
      if ("attachment" in data) throw new MemberAppServiceError("validation", "Notice files cannot be replaced after creation.");
      const valid = parseInput(noticePatchSchema, data);
      const result = await request(memberAppAdminEndpoints.notice(id), memberAppResponseSchemas.notice, {
        method: "PATCH", ...jsonBody(toNoticePayload(valid)),
      });
      return noticeFromApi(result.notice);
    },
    getNoticeAttachmentStream(id) {
      return request(memberAppAdminEndpoints.noticeAttachment(id), z.custom<Response>(), { stream: true });
    },
    async searchMembers(query) {
      const validQuery = parseInput(z.string().trim().min(2).max(80), query);
      const result = await request(memberAppAdminEndpoints.members, memberAppResponseSchemas.members, {
        query: new URLSearchParams({ search: validQuery }),
      });
      return result.members.map((member) => ({
        id: member.id,
        name: member.name,
        identifier: member.memberNumber,
        memberNumber: member.memberNumber,
        membershipStatus: member.membershipStatus,
      }));
    },
    async listDocuments(filters = {}) {
      const query = paginationQuery(filters);
      const valid = parseInput(z.object({
        status: documentStatusSchema.optional(),
        audience: audienceSchema.optional(),
        search: z.string().trim().max(120).optional(),
        page: pageInteger.optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }).strict(), filters);
      if (valid.status) query.set("status", valid.status);
      if (valid.audience) query.set("audience", valid.audience);
      if (valid.search) query.set("search", valid.search);
      const result = await request(memberAppAdminEndpoints.documents, memberAppResponseSchemas.documents, { query });
      return {
        documents: result.documents.map(documentFromApi),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
    async getDocument(id) {
      const result = await request(memberAppAdminEndpoints.document(id), memberAppResponseSchemas.document);
      return documentFromApi(result.document);
    },
    async createDocument(data, file) {
      validateFile(file, true);
      const valid = parseInput(documentCreateSchema, data);
      const result = await request(memberAppAdminEndpoints.documents, memberAppResponseSchemas.document, {
        method: "POST",
        body: multipartBody("document", toDocumentPayload(valid), file),
      });
      return documentFromApi(result.document);
    },
    async updateDocument(id, data) {
      if ("file" in data) throw new MemberAppServiceError("validation", "Document files cannot be replaced after creation.");
      const valid = parseInput(documentPatchSchema, data);
      const result = await request(memberAppAdminEndpoints.document(id), memberAppResponseSchemas.document, {
        method: "PATCH", ...jsonBody(toDocumentPayload(valid)),
      });
      return documentFromApi(result.document);
    },
    getDocumentFileStream(id) {
      return request(memberAppAdminEndpoints.documentFile(id), z.custom<Response>(), { stream: true });
    },
  };
}

export function getMemberAppAdminClient(
  tenant: ResolvedTenant,
  /** Authenticated actor supplied by trusted server-side code, not browser input. */
  actorUserId?: string,
): MemberAppAdminClient | null {
  if (tenant.slug !== "swcu") return null;
  try {
    const environment = getServerEnvironment();
    const baseUrl = environment.SWCU_MEMBER_APP_API_BASE_URL;
    const serviceKey = environment.SWCU_MEMBER_APP_ADMIN_SERVICE_KEY;
    if (!baseUrl || !serviceKey) return null;
    return createMemberAppAdminClient({ baseUrl, serviceKey, actorUserId });
  } catch {
    return null;
  }
}