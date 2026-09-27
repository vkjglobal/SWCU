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
  identifier: string;
};

export type RequestAttachment = { id: string; name: string };
export type MemberRequestSummary = {
  id: string;
  reference: string;
  member: MemberSummary;
  type: string;
  submittedAt: string;
  status: RequestStatus;
  updatedAt: string;
};
export type MemberRequestDetail = MemberRequestSummary & {
  fields: Record<string, unknown>;
  attachments: RequestAttachment[];
  memberMessage: string | null;
  internalNotes: Array<{ id: string; text: string; createdAt: string; author: string }>;
  history: Array<{ id: string; description: string; createdAt: string; actor: string }>;
};

export type MemberNotice = {
  id: string;
  title: string;
  message: string;
  audience: MemberAudience;
  member: MemberSummary | null;
  attachment: RequestAttachment | null;
  showFrom: string | null;
  showUntil: string | null;
  status: NoticeStatus;
  updatedAt: string;
};
export type MemberNoticeData = {
  title: string;
  message: string;
  audience: MemberAudience;
  memberId?: string;
  attachment?: File | null;
  /** Omit to leave unchanged; send null to clear the saved schedule value. */
  showFrom?: string | null;
  /** Omit to leave unchanged; send null to clear the saved schedule value. */
  showUntil?: string | null;
  status: NoticeStatus;
};

export type MemberDocument = {
  id: string;
  title: string;
  shortDescription: string;
  audience: MemberAudience;
  member: MemberSummary | null;
  documentType: string;
  file: RequestAttachment | null;
  availableFrom: string | null;
  availableUntil: string | null;
  status: DocumentStatus;
  updatedAt: string;
};
export type MemberDocumentData = {
  title: string;
  shortDescription: string;
  audience: MemberAudience;
  memberId?: string;
  documentType: string;
  /** Omit to leave unchanged; send null to clear the saved availability value. */
  availableFrom?: string | null;
  /** Omit to leave unchanged; send null to clear the saved availability value. */
  availableUntil?: string | null;
  status: DocumentStatus;
};

const nonEmpty = z.string().trim().min(1);
const memberSchema = z.object({
  id: nonEmpty,
  name: nonEmpty,
  identifier: nonEmpty,
});
const attachmentSchema = z.object({ id: nonEmpty, name: nonEmpty });
const requestSummarySchema = z.object({
  id: nonEmpty,
  reference: nonEmpty,
  member: memberSchema,
  type: nonEmpty,
  submittedAt: nonEmpty,
  status: z.enum(requestStatuses),
  updatedAt: nonEmpty,
});
const requestDetailSchema = requestSummarySchema.extend({
  fields: z.record(z.string(), z.unknown()),
  attachments: z.array(attachmentSchema),
  memberMessage: z.string().nullable(),
  internalNotes: z.array(z.object({
    id: nonEmpty,
    text: z.string(),
    createdAt: nonEmpty,
    author: nonEmpty,
  })),
  history: z.array(z.object({
    id: nonEmpty,
    description: z.string(),
    createdAt: nonEmpty,
    actor: nonEmpty,
  })),
});
const noticeSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  message: z.string(),
  audience: z.enum(memberAudiences),
  member: memberSchema.nullable(),
  attachment: attachmentSchema.nullable(),
  showFrom: z.string().nullable(),
  showUntil: z.string().nullable(),
  status: z.enum(noticeStatuses),
  updatedAt: nonEmpty,
});
const documentSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  shortDescription: z.string(),
  audience: z.enum(memberAudiences),
  member: memberSchema.nullable(),
  documentType: nonEmpty,
  file: attachmentSchema.nullable(),
  availableFrom: z.string().nullable(),
  availableUntil: z.string().nullable(),
  status: z.enum(documentStatuses),
  updatedAt: nonEmpty,
});

export const memberAppResponseSchemas = {
  requestSummary: requestSummarySchema,
  requestSummaries: z.array(requestSummarySchema),
  requestDetail: requestDetailSchema,
  notice: noticeSchema,
  notices: z.array(noticeSchema),
  document: documentSchema,
  documents: z.array(documentSchema),
  members: z.array(memberSchema),
};