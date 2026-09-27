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
  type MemberDocument,
  type MemberDocumentData,
  type MemberNotice,
  type MemberNoticeData,
  type MemberRequestDetail,
  type MemberRequestSummary,
  type MemberSummary,
  type RequestStatus,
} from "@/lib/member-app-admin-contract";

export { requestStatuses, noticeStatuses, documentStatuses, memberAudiences };
export type {
  DocumentStatus,
  MemberAudience,
  MemberDocument,
  MemberDocumentData,
  MemberNotice,
  MemberNoticeData,
  MemberRequestDetail,
  MemberRequestSummary,
  MemberSummary,
  NoticeStatus,
  RequestStatus,
} from "@/lib/member-app-admin-contract";

const REQUEST_TIMEOUT_MS = 10_000;
const identifierSchema = z.string().trim().min(1).max(200)
  .regex(/^(?!\.{1,2}$)[^/\\\u0000-\u001f\u007f]+$/);
const optionalDateField = z.union([z.string().date(), z.string().datetime()]).nullable().optional();
const requestStatusSchema = z.enum(requestStatuses);
const noticeStatusSchema = z.enum(noticeStatuses);
const documentStatusSchema = z.enum(documentStatuses);
const audienceSchema = z.enum(memberAudiences);
const requestUpdateSchema = z.object({
  status: requestStatusSchema,
  memberMessage: z.string().max(10_000).optional(),
}).strict();
const noticeDataSchema = z.object({
  title: z.string().trim().min(1).max(250),
  message: z.string().min(1).max(50_000),
  audience: audienceSchema,
  memberId: identifierSchema.optional(),
  showFrom: optionalDateField,
  showUntil: optionalDateField,
  status: noticeStatusSchema,
}).strict().refine(
  (value) => value.audience === "Individual Member" ? Boolean(value.memberId) : !value.memberId,
  "Select a member only for an individual-member audience.",
);
const documentDataSchema = z.object({
  title: z.string().trim().min(1).max(250),
  shortDescription: z.string().max(2_000),
  audience: audienceSchema,
  memberId: identifierSchema.optional(),
  documentType: z.string().trim().min(1).max(150),
  availableFrom: optionalDateField,
  availableUntil: optionalDateField,
  status: documentStatusSchema,
}).strict().refine(
  (value) => value.audience === "Individual Member" ? Boolean(value.memberId) : !value.memberId,
  "Select a member only for an individual-member audience.",
);

export class MemberAppServiceError extends Error {
  readonly code: "disconnected" | "invalid_configuration" | "timeout" | "network" | "http" | "invalid_response" | "validation";
  readonly status?: number;

  constructor(
    code: MemberAppServiceError["code"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "MemberAppServiceError";
    this.code = code;
    this.status = status;
  }
}

export type MemberAppAdminClient = {
  listRequests(filters?: { status?: RequestStatus; type?: string; search?: string }): Promise<MemberRequestSummary[]>;
  getRequest(id: string): Promise<MemberRequestDetail>;
  updateRequest(id: string, data: { status: RequestStatus; memberMessage?: string }): Promise<MemberRequestDetail>;
  addInternalNote(id: string, note: string): Promise<MemberRequestDetail>;
  getAttachmentAccess(requestId: string, attachmentId: string): Promise<string>;
  listNotices(): Promise<MemberNotice[]>;
  getNotice(id: string): Promise<MemberNotice>;
  createNotice(data: MemberNoticeData): Promise<MemberNotice>;
  updateNotice(id: string, data: MemberNoticeData): Promise<MemberNotice>;
  searchMembers(query: string): Promise<MemberSummary[]>;
  listDocuments(): Promise<MemberDocument[]>;
  getDocument(id: string): Promise<MemberDocument>;
  createDocument(data: MemberDocumentData, file: File): Promise<MemberDocument>;
  updateDocument(id: string, data: MemberDocumentData, file?: File): Promise<MemberDocument>;
};

export type MemberAppAdminClientConfig = {
  baseUrl?: string;
  serviceKey?: string;
  /** Must come from the authenticated server-side staff session, never a request body. */
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
  requests: "/admin/requests",
  request: (id: string) => itemPath("/admin/requests", id),
  requestInternalNotes: (id: string) => `${itemPath("/admin/requests", id)}/internal-notes`,
  requestAttachmentAccess: (requestId: string, attachmentId: string) =>
    `${itemPath("/admin/requests", requestId)}/attachments/${encodeURIComponent(validateIdentifier(attachmentId))}/access`,
  notices: "/admin/notices",
  notice: (id: string) => itemPath("/admin/notices", id),
  members: "/admin/members",
  documents: "/admin/documents",
  document: (id: string) => itemPath("/admin/documents", id),
} as const;

function apiUrl(baseUrl: string, path: string, query?: URLSearchParams): URL {
  const url = new URL(path.replace(/^\/+/, ""), `${baseUrl.replace(/\/+$/, "")}/`);
  if (query) url.search = query.toString();
  return url;
}

function validateFile(file: File | undefined, required: boolean): void {
  if (!file && required) throw new MemberAppServiceError("validation", "A document file is required.");
  if (file && (typeof file.name !== "string" || !file.name.trim() || typeof file.size !== "number")) {
    throw new MemberAppServiceError("validation", "The selected file is not valid.");
  }
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new MemberAppServiceError("validation", "The submitted Member App data is not valid.");
  return parsed.data;
}

export function createMemberAppAdminClient(
  config: MemberAppAdminClientConfig,
  fetchImpl: FetchImplementation = fetch,
): MemberAppAdminClient | null {
  if (!config.baseUrl || !config.serviceKey) return null;
  const parsedBase = (() => {
    try {
      return new URL(config.baseUrl);
    } catch {
      throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
    }
  })();
  if (parsedBase.protocol !== "https:" || parsedBase.username || parsedBase.password || !config.serviceKey.trim()) {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }
  const actorUserId = config.actorUserId
    ? identifierSchema.safeParse(config.actorUserId).success
      ? config.actorUserId.trim()
      : (() => { throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid."); })()
    : undefined;
  const timeoutMs = config.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const baseUrl = parsedBase.toString();
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new MemberAppServiceError("invalid_configuration", "Member App service configuration is invalid.");
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: { method?: string; body?: BodyInit; contentType?: string; query?: URLSearchParams } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers({ authorization: `Bearer ${config.serviceKey}`, accept: "application/json" });
    if (actorUserId) headers.set("X-Staff-Actor-ID", actorUserId);
    if (options.contentType) headers.set("content-type", options.contentType);
    try {
      let response: Response;
      try {
        response = await fetchImpl(apiUrl(baseUrl, path, options.query), {
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

  function multipartBody(data: unknown, file?: File): FormData {
    const form = new FormData();
    form.set("data", JSON.stringify(data));
    if (file) form.set("file", file, file.name);
    return form;
  }

function noticePayload(data: MemberNoticeData): Omit<MemberNoticeData, "attachment"> {
  return {
    title: data.title,
    message: data.message,
    audience: data.audience,
    ...(data.memberId ? { memberId: data.memberId } : {}),
    ...(data.showFrom !== undefined ? { showFrom: data.showFrom } : {}),
    ...(data.showUntil !== undefined ? { showUntil: data.showUntil } : {}),
    status: data.status,
  };
}

  return {
    async listRequests(filters = {}) {
      const query = new URLSearchParams();
      if (filters.status) query.set("status", parseInput(requestStatusSchema, filters.status));
      if (filters.type?.trim()) query.set("type", filters.type.trim());
      if (filters.search?.trim()) query.set("search", filters.search.trim());
      return request(memberAppAdminEndpoints.requests, memberAppResponseSchemas.requestSummaries, { query });
    },
    getRequest(id) {
      return request(memberAppAdminEndpoints.request(id), memberAppResponseSchemas.requestDetail);
    },
    updateRequest(id, data) {
      const valid = parseInput(requestUpdateSchema, data);
      const body = jsonBody(valid);
      return request(memberAppAdminEndpoints.request(id), memberAppResponseSchemas.requestDetail, {
        method: "PATCH", ...body,
      });
    },
    addInternalNote(id, note) {
      const validNote = parseInput(z.string().trim().min(1).max(10_000), note);
      const body = jsonBody({ note: validNote });
      return request(memberAppAdminEndpoints.requestInternalNotes(id), memberAppResponseSchemas.requestDetail, {
        method: "POST", ...body,
      });
    },
    async getAttachmentAccess(requestId, attachmentId) {
      const bodySchema = z.object({ url: z.string().url() });
      const response = await request(
        memberAppAdminEndpoints.requestAttachmentAccess(requestId, attachmentId),
        bodySchema,
        { method: "POST", ...jsonBody({}) },
      );
      let url: URL;
      try {
        url = new URL(response.url);
      } catch {
        throw new MemberAppServiceError("invalid_response", "Member App service returned an invalid attachment link.");
      }
      if (url.protocol !== "https:") {
        throw new MemberAppServiceError("invalid_response", "Member App service returned an invalid attachment link.");
      }
      return url.toString();
    },
    listNotices() {
      return request(memberAppAdminEndpoints.notices, memberAppResponseSchemas.notices);
    },
    getNotice(id) {
      return request(memberAppAdminEndpoints.notice(id), memberAppResponseSchemas.notice);
    },
    createNotice(data) {
      const file = data.attachment ?? undefined;
      validateFile(file, false);
      const valid = parseInput(noticeDataSchema, noticePayload(data));
      const body = file
        ? { body: multipartBody(valid, file) }
        : { ...jsonBody(valid) };
      return request(memberAppAdminEndpoints.notices, memberAppResponseSchemas.notice, { method: "POST", ...body });
    },
    updateNotice(id, data) {
      const file = data.attachment ?? undefined;
      validateFile(file, false);
      const valid = parseInput(noticeDataSchema, noticePayload(data));
      const body = file
        ? { body: multipartBody(valid, file) }
        : { ...jsonBody(valid) };
      return request(memberAppAdminEndpoints.notice(id), memberAppResponseSchemas.notice, { method: "PATCH", ...body });
    },
    searchMembers(query) {
      const validQuery = parseInput(z.string().trim().min(1).max(200), query);
      return request(memberAppAdminEndpoints.members, memberAppResponseSchemas.members, {
        query: new URLSearchParams({ search: validQuery }),
      });
    },
    listDocuments() {
      return request(memberAppAdminEndpoints.documents, memberAppResponseSchemas.documents);
    },
    getDocument(id) {
      return request(memberAppAdminEndpoints.document(id), memberAppResponseSchemas.document);
    },
    createDocument(data, file) {
      const valid = parseInput(documentDataSchema, data);
      validateFile(file, true);
      return request(memberAppAdminEndpoints.documents, memberAppResponseSchemas.document, {
        method: "POST",
        body: multipartBody(valid, file),
      });
    },
    updateDocument(id, data, file) {
      const valid = parseInput(documentDataSchema, data);
      validateFile(file, false);
      const body = file
        ? { body: multipartBody(valid, file) }
        : { ...jsonBody(valid) };
      return request(memberAppAdminEndpoints.document(id), memberAppResponseSchemas.document, {
        method: "PATCH", ...body,
      });
    },
  };
}

export function getMemberAppAdminClient(
  tenant: ResolvedTenant,
  /** Authenticated actor supplied by trusted server-side code, not browser input. */
  actorUserId?: string,
): MemberAppAdminClient | null {
  if (tenant.slug !== "swcu") return null;
  const environment = getServerEnvironment();
  const baseUrl = environment.SWCU_MEMBER_APP_API_BASE_URL;
  const serviceKey = environment.SWCU_MEMBER_APP_ADMIN_SERVICE_KEY;
  if (!baseUrl || !serviceKey) return null;
  try {
    return createMemberAppAdminClient({ baseUrl, serviceKey, actorUserId });
  } catch {
    return null;
  }
}