import { z } from "zod";

export const requestStatuses = [
  "Processing",
  "Approved",
  "More Information Needed",
  "Completed",
  "Declined",
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const noticeStatuses = ["Draft", "Active", "Scheduled", "Expired"] as const;
export type NoticeStatus = (typeof noticeStatuses)[number];
export const documentStatuses = ["Draft", "Available", "Scheduled", "Expired"] as const;
export type DocumentStatus = (typeof documentStatuses)[number];
export const memberAudiences = ["All Members", "Individual Member"] as const;
export type MemberAudience = (typeof memberAudiences)[number];

export type MemberSummary = {
  id: string;
  name: string;
  /** The member number (or the service's membership identifier). */
  identifier: string;
  memberNumber?: string;
  membershipStatus?: string;
  email?: string | null;
  mobile?: string | null;
};

export type RequestAttachment = {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
  createdAt?: string;
  responseId?: string | null;
};
export type MemberRequestSummary = {
  id: string;
  reference: string;
  member: MemberSummary;
  type: string;
  formCode: string;
  submittedAt: string;
  status: RequestStatus;
  updatedAt: string;
};
export type RequestField = { key: string; label: string; value: unknown };
export type MemberRequestDetail = MemberRequestSummary & {
  fields: Record<string, unknown>;
  orderedFields: RequestField[];
  confirmation: unknown;
  formVersion: string | number | null;
  attachments: RequestAttachment[];
  memberMessage: string | null;
  internalNotes: Array<{ id: string; text: string; createdAt: string; author?: string }>;
  history: Array<{ id: string; description: string; createdAt: string; actor: string }>;
  responses: Array<{
    id: string;
    message: string | null;
    createdAt: string;
    memberId: string;
    attachments: RequestAttachment[];
  }>;
};
export type MemberRequestUpdate = {
  id: string;
  reference: string;
  status?: RequestStatus;
  memberMessage?: string | null;
  updatedAt: string;
};
export type MemberInternalNote = { id: string; createdAt: string };
export type PageResult<T, K extends string> = {
  [P in K]: T[];
} & { page: number; pageSize: number; total: number };

export type PrivateFileMetadata = {
  name: string;
  size: number;
  contentType: string;
};
export type MemberNotice = {
  id: string;
  title: string;
  message: string;
  preview: string;
  audience: MemberAudience;
  member: MemberSummary | null;
  attachment: PrivateFileMetadata | null;
  showFrom: string | null;
  showUntil: string | null;
  status: NoticeStatus;
  storedStatus: NoticeStatus;
  createdAt: string;
  updatedAt: string;
  hasAttachment: boolean;
};
export type MemberNoticeData = {
  title: string;
  message: string;
  audience: MemberAudience;
  memberId?: string | null;
  attachment?: File | null;
  showFrom?: string | null;
  showUntil?: string | null;
  status?: NoticeStatus;
};
export type MemberNoticeFilters = {
  status?: NoticeStatus;
  audience?: MemberAudience;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type MemberDocument = {
  id: string;
  title: string;
  shortDescription: string;
  audience: MemberAudience;
  member: MemberSummary | null;
  documentType: string;
  file: PrivateFileMetadata;
  availableFrom: string | null;
  availableUntil: string | null;
  status: DocumentStatus;
  storedStatus: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};
export type MemberDocumentData = {
  title: string;
  shortDescription: string;
  audience: MemberAudience;
  memberId?: string | null;
  documentType: string;
  availableFrom?: string | null;
  availableUntil?: string | null;
  status?: DocumentStatus;
};
export type MemberDocumentFilters = {
  status?: DocumentStatus;
  audience?: MemberAudience;
  search?: string;
  page?: number;
  pageSize?: number;
};
export type RequestFilters = {
  status?: RequestStatus;
  formCode?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

const nonEmpty = z.string().trim().min(1);
const memberSchema = z.object({
  id: nonEmpty,
  number: nonEmpty.optional(),
  memberNumber: nonEmpty.optional(),
  fullName: nonEmpty.optional(),
  name: nonEmpty.optional(),
  membershipStatus: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
}).passthrough()
  .refine((value) => Boolean(value.fullName ?? value.name), "Member name is missing.")
  .refine((value) => Boolean(value.number ?? value.memberNumber), "Member number is missing.");
const requestListItemSchema = z.object({
  id: nonEmpty,
  reference: nonEmpty,
  formCode: nonEmpty,
  requestType: nonEmpty,
  formName: nonEmpty,
  submittedAt: nonEmpty,
  status: z.enum(requestStatuses),
  updatedAt: nonEmpty,
  member: memberSchema,
}).passthrough();
const attachmentSchema = z.object({
  id: nonEmpty,
  name: nonEmpty,
  size: z.number().nonnegative(),
  contentType: nonEmpty,
  createdAt: nonEmpty,
  responseId: z.string().nullable(),
}).passthrough();
const responseAttachmentSchema = z.object({
  id: nonEmpty,
  name: nonEmpty,
  size: z.number().nonnegative(),
}).passthrough();
const orderedFieldSchema = z.object({
  key: nonEmpty,
  label: nonEmpty,
  value: z.unknown(),
}).passthrough();
const staffNoteSchema = z.object({
  id: nonEmpty,
  note: z.string(),
  createdAt: nonEmpty,
  actor: nonEmpty,
}).passthrough();
const activitySchema = z.object({
  id: nonEmpty,
  actorType: nonEmpty,
  actorId: z.string().nullable().optional(),
  eventType: nonEmpty,
  message: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  createdAt: nonEmpty,
}).passthrough();
const responseSchema = z.object({
  id: nonEmpty,
  message: z.string().nullable().optional(),
  createdAt: nonEmpty,
  memberId: nonEmpty,
  attachments: z.array(responseAttachmentSchema),
}).passthrough();
const requestDetailSchema = requestListItemSchema.extend({
  formVersion: z.union([z.string(), z.number()]).nullable(),
  fields: z.array(orderedFieldSchema),
  confirmation: z.unknown().refine((value) => value !== undefined),
  memberMessage: z.string().nullable(),
  attachments: z.array(attachmentSchema),
  internalNotes: z.array(staffNoteSchema),
  activities: z.array(activitySchema),
  responses: z.array(responseSchema),
}).passthrough();
const requestMutationSchema = z.object({
  id: nonEmpty,
  reference: nonEmpty,
  status: z.enum(requestStatuses).optional(),
  memberMessage: z.string().nullable().optional(),
  updatedAt: nonEmpty,
}).passthrough();
const noteResultSchema = z.object({ id: nonEmpty, createdAt: nonEmpty }).passthrough();

const privateFileSchema = z.object({
  name: nonEmpty,
  size: z.number().nonnegative(),
  contentType: nonEmpty,
}).passthrough();
const noticeSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  message: z.string(),
  preview: z.string(),
  audience: z.enum(memberAudiences),
  targetMember: memberSchema.nullable(),
  showFrom: z.string().nullable(),
  showUntil: z.string().nullable(),
  status: z.enum(noticeStatuses),
  storedStatus: z.enum(noticeStatuses),
  createdAt: nonEmpty,
  updatedAt: nonEmpty,
  hasAttachment: z.boolean(),
  attachment: privateFileSchema.nullable(),
}).passthrough().refine(
  (notice) => notice.hasAttachment === (notice.attachment !== null),
  "Notice attachment metadata is inconsistent.",
);
const documentSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  description: z.string(),
  documentType: nonEmpty,
  audience: z.enum(memberAudiences),
  targetMember: memberSchema.nullable(),
  availableFrom: z.string().nullable(),
  availableUntil: z.string().nullable(),
  status: z.enum(documentStatuses),
  storedStatus: z.enum(documentStatuses),
  createdAt: nonEmpty,
  updatedAt: nonEmpty,
  fileName: nonEmpty,
  fileSize: z.number().nonnegative(),
  contentType: nonEmpty,
}).passthrough();
const memberSearchSchema = z.object({
  id: nonEmpty,
  memberNumber: nonEmpty,
  name: nonEmpty,
  membershipStatus: nonEmpty,
}).passthrough();
const pageSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export const memberAppResponseSchemas = {
  requestList: z.object({ requests: z.array(requestListItemSchema) }).merge(pageSchema),
  requestDetail: z.object({ request: requestDetailSchema }),
  requestMutation: z.object({ request: requestMutationSchema }),
  internalNote: z.object({ note: noteResultSchema }),
  notices: z.object({ notices: z.array(noticeSchema) }).merge(pageSchema),
  notice: z.object({ notice: noticeSchema }),
  documents: z.object({ documents: z.array(documentSchema) }).merge(pageSchema),
  document: z.object({ document: documentSchema }),
  members: z.object({ members: z.array(memberSearchSchema) }),
};

export type ApiRequestListItem = z.infer<typeof requestListItemSchema>;
export type ApiRequestDetail = z.infer<typeof requestDetailSchema>;
export type ApiNotice = z.infer<typeof noticeSchema>;
export type ApiDocument = z.infer<typeof documentSchema>;