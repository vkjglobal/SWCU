import {
  createMemberAppAdminClient,
  MemberAppServiceError,
} from "../src/lib/member-app-admin";

let assertions = 0;
function check(condition: unknown, message: string): void {
  if (!condition) throw new Error(`Member App Admin assertion failed: ${message}`);
  assertions += 1;
}

async function expectServiceError(action: () => unknown | Promise<unknown>, code: MemberAppServiceError["code"], status?: number) {
  try {
    await action();
    throw new Error(`Expected MemberAppServiceError (${code}).`);
  } catch (error) {
    if (!(error instanceof MemberAppServiceError) || error.code !== code || (status !== undefined && error.status !== status)) {
      throw error;
    }
    assertions += 1;
  }
}

const disconnected = createMemberAppAdminClient({ baseUrl: "https://member.example.test" }, fetch);
check(disconnected === null, "missing service key yields a disconnected client without fetching");
check(createMemberAppAdminClient({ serviceKey: "secret" }, fetch) === null, "missing API base URL yields a disconnected client");

const requestRecord = {
  id: "request-1",
  reference: "SWCU-R-001",
  formCode: "loan-application",
  requestType: "LOAN_APPLICATION",
  formName: "Loan Application",
  submittedAt: "2026-01-01T00:00:00.000Z",
  status: "Processing",
  updatedAt: "2026-01-02T00:00:00.000Z",
  member: {
    id: "member-1", number: "M-001", fullName: "Test Member",
    email: "member@example.invalid", mobile: "000 0000",
  },
};
const requestDetailRecord = {
  ...requestRecord,
  formVersion: "v2",
  fields: [{ key: "address", label: "Residential address", value: "Private address" }],
  confirmation: { accepted: true },
  memberMessage: null,
  attachments: [{
    id: "attachment-1", name: "form.pdf", size: 25, contentType: "application/pdf",
    createdAt: "2026-01-01T00:01:00.000Z", responseId: null,
  }],
  internalNotes: [{ id: "note-1", note: "Staff-only note", createdAt: "2026-01-02T00:00:00.000Z", actor: "Staff A" }],
  activities: [{
    id: "event-1", actorType: "staff", actorId: "staff-1", eventType: "status_changed",
    message: "Request reviewed", status: "Processing", createdAt: "2026-01-02T00:00:00.000Z",
  }],
  responses: [{
    id: "response-1", message: "Supporting file attached", createdAt: "2026-01-01T00:02:00.000Z", memberId: "member-1",
    attachments: [{ id: "response-file-1", name: "response.pdf", size: 15 }],
  }],
};
const noticeRecord = {
  id: "notice-1", title: "Notice", message: "Member-only message", preview: "Member-only",
  audience: "Individual Member", targetMember: {
    id: "member-1", memberNumber: "M-001", name: "Test Member", membershipStatus: "Active",
  },
  showFrom: null, showUntil: null, status: "Draft", storedStatus: "Draft",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  hasAttachment: true, attachment: { name: "notice.pdf", size: 20, contentType: "application/pdf" },
};
const documentRecord = {
  id: "document-1", title: "Private document", description: "Member-only description",
  documentType: "Circular", audience: "All Members", targetMember: null,
  availableFrom: null, availableUntil: null, status: "Draft", storedStatus: "Draft",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  fileName: "document.pdf", fileSize: 20, contentType: "application/pdf",
};
const pagedRequests = { requests: [requestRecord], page: 2, pageSize: 10, total: 21 };
const pagedNotices = { notices: [noticeRecord], page: 1, pageSize: 25, total: 1 };
const pagedDocuments = { documents: [documentRecord], page: 1, pageSize: 25, total: 1 };
const streamResponse = () => new Response("private file bytes", {
  headers: {
    "content-type": "application/pdf",
    "content-disposition": 'attachment; filename="private.pdf"',
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  },
});

let lastUrl = "";
let lastInit: RequestInit | undefined;
let lastPath = "";
const fetchMock = (async (input, init) => {
  lastUrl = String(input);
  lastInit = init;
  const url = new URL(lastUrl);
  lastPath = url.pathname;
  const method = init?.method ?? "GET";
  if (url.pathname === "/member-admin/requests" && method === "GET") return Response.json(pagedRequests);
  if ((url.pathname === "/member-admin/requests/request-1"
    || url.pathname === "/member-admin/requests/request%20with%20space") && method === "GET") {
    return Response.json({ request: requestDetailRecord });
  }
  if (url.pathname === "/member-admin/requests/request-1/status" && method === "PATCH") {
    return Response.json({ request: {
      id: "request-1", reference: "SWCU-R-001", status: "Approved",
      memberMessage: null, updatedAt: "2026-01-03T00:00:00.000Z",
    } });
  }
  if (url.pathname === "/member-admin/requests/request-1/internal-notes" && method === "POST") {
    return Response.json({ note: { id: "note-2", createdAt: "2026-01-03T00:00:00.000Z" } }, { status: 201 });
  }
  if (url.pathname.includes("/attachments/") || url.pathname.endsWith("/attachment") || url.pathname.endsWith("/file")) {
    return streamResponse();
  }
  if (url.pathname === "/member-admin/notices" && method === "GET") return Response.json(pagedNotices);
  if (url.pathname === "/member-admin/notices" && method === "POST") return Response.json({ notice: noticeRecord }, { status: 201 });
  if (url.pathname === "/member-admin/notices/notice-1" && method === "GET") return Response.json({ notice: noticeRecord });
  if (url.pathname === "/member-admin/notices/notice-1" && method === "PATCH") return Response.json({ notice: noticeRecord });
  if (url.pathname === "/member-admin/members") {
    return Response.json({ members: [{ id: "member-1", memberNumber: "M-001", name: "Test Member", membershipStatus: "Active" }] });
  }
  if (url.pathname === "/member-admin/documents" && method === "GET") return Response.json(pagedDocuments);
  if (url.pathname === "/member-admin/documents" && method === "POST") return Response.json({ document: documentRecord }, { status: 201 });
  if (url.pathname === "/member-admin/documents/document-1" && method === "GET") return Response.json({ document: documentRecord });
  if (url.pathname === "/member-admin/documents/document-1" && method === "PATCH") return Response.json({ document: documentRecord });
  return new Response(null, { status: 404 });
}) as typeof fetch;

const client = createMemberAppAdminClient({
  baseUrl: "https://member.example.test/api/",
  serviceKey: "server-only-test-key",
  actorUserId: "staff-user-42",
}, fetchMock);
check(client !== null, "complete configuration creates a client");
if (!client) throw new Error("Expected configured Member App client.");

const requests = await client.listRequests({
  status: "Processing", formCode: "LOAN_APPLICATION", search: "M-001", page: 2, pageSize: 10,
});
check(lastPath === "/member-admin/requests", "request endpoint is outside /api at the contract path");
check(new URL(lastUrl).searchParams.toString() === "page=2&pageSize=10&status=Processing&formCode=LOAN_APPLICATION&search=M-001",
  "request filters and pagination use contract query keys");
check(requests.page === 2 && requests.pageSize === 10 && requests.total === 21 && requests.requests[0].type === "Loan Application",
  "wrapped request pagination maps into a typed page result");
check(requests.requests[0].member.identifier === "M-001", "request member number maps to the UI identifier");
check(lastInit?.method === "GET" && lastInit.cache === "no-store", "private requests disable caching");
check(new Headers(lastInit?.headers).get("authorization") === "Bearer server-only-test-key", "request uses bearer authorization");
check(new Headers(lastInit?.headers).get("x-admin-actor") === "staff-user-42", "audit actor uses x-admin-actor");
check(new URL(String(lastUrl)).pathname.startsWith("/member-admin/"), "configured /api prefix is not used for API endpoints");

await client.getRequest("request with space");
check(lastUrl.endsWith("/member-admin/requests/request%20with%20space"), "request IDs are safely encoded as path segments");
const actualDetail = await client.getRequest("request-1");
check(lastUrl.endsWith("/member-admin/requests/request-1"), "request detail uses exact contract path");
check(actualDetail.fields["Residential address"] === "Private address"
  && actualDetail.orderedFields[0].key === "address", "ordered labelled fields are preserved and adapted for existing UI");
check(actualDetail.responses[0].attachments[0].id === "response-file-1"
  && actualDetail.responses[0].memberId === "member-1"
  && actualDetail.history[0].description.startsWith("status_changed"), "request activities and member responses map accurately");
await client.updateRequest("request-1", { memberMessage: null });
check(lastPath === "/member-admin/requests/request-1/status" && lastInit?.method === "PATCH",
  "request status/message mutation uses PATCH /status");
check(JSON.parse(String(lastInit?.body)).memberMessage === null, "request member message null clears are preserved");
await client.updateRequest("request-1", { status: "Approved" });
check(JSON.parse(String(lastInit?.body)).status === "Approved", "request update allows status without a message");
await expectServiceError(() => client.updateRequest("request-1", {}), "validation");
await client.addInternalNote("request-1", "Staff-only note");
check(lastPath.endsWith("/internal-notes") && lastInit?.method === "POST"
  && JSON.parse(String(lastInit?.body)).note === "Staff-only note", "internal note endpoint/body follows contract");

const reqStream = await client.getRequestAttachmentStream("request-1", "attachment-1");
check(lastPath === "/member-admin/requests/request-1/attachments/attachment-1"
  && lastInit?.method === "GET" && reqStream.headers.get("content-disposition")?.startsWith("attachment"),
  "protected request bytes stream from direct GET, never a signed URL");

const notices = await client.listNotices({ status: "Draft", audience: "Individual Member", search: "Member", page: 1, pageSize: 25 });
check(lastPath === "/member-admin/notices" && notices.total === 1 && notices.notices[0].member?.identifier === "M-001",
  "notice wrapper, pagination, and target member map correctly");
check(new URL(lastUrl).searchParams.get("audience") === "Individual Member"
  && new URL(lastUrl).searchParams.get("search") === "Member", "notice filters follow contract");
await client.getNotice("notice-1");
const noticeFile = new File(["private"], "notice.pdf", { type: "application/pdf" });
await client.createNotice({
  title: "Notice", message: "Member message", audience: "Individual Member", memberId: "member-1",
  status: "Draft", attachment: noticeFile,
});
check(lastInit?.body instanceof FormData && (lastInit.body as FormData).get("notice") !== null
  && (lastInit.body as FormData).get("file") instanceof File, "notice create uses notice JSON multipart field and optional file");
const noticePart = JSON.parse(String((lastInit?.body as FormData).get("notice")));
check(noticePart.targetMemberId === "member-1" && noticePart.memberId === undefined, "notice target ID maps to contract field");
await client.updateNotice("notice-1", { showFrom: null, memberId: null, status: "Active" });
check(lastInit?.method === "PATCH" && typeof lastInit.body === "string"
  && JSON.parse(lastInit.body).showFrom === null && JSON.parse(lastInit.body).targetMemberId === null,
  "notice PATCH is metadata-only JSON and preserves null clears");
await expectServiceError(() => client.updateNotice("notice-1", {
  title: "Notice", attachment: noticeFile,
} as never), "validation");
const noticeStream = await client.getNoticeAttachmentStream("notice-1");
check(lastPath === "/member-admin/notices/notice-1/attachment" && noticeStream.ok, "notice attachment uses protected stream route");

const members = await client.searchMembers("Member one");
check(lastPath === "/member-admin/members" && new URL(lastUrl).searchParams.get("search") === "Member one",
  "member search uses contract route/query");
check(members[0].id === "member-1" && members[0].identifier === "M-001"
  && members[0].membershipStatus === "Active", "member search wrapper maps only authentic member fields");

const documents = await client.listDocuments({ status: "Draft", audience: "All Members", search: "Private" });
check(lastPath === "/member-admin/documents" && documents.documents[0].shortDescription === "Member-only description",
  "document wrapped list maps description into the UI DTO");
await client.getDocument("document-1");
const uploadFile = new File(["private document bytes"], "annual-report.pdf", { type: "application/pdf" });
await client.createDocument({
  title: "Annual report", shortDescription: "Member-only report", audience: "All Members",
  documentType: "Annual Report", status: "Draft",
}, uploadFile);
check(lastInit?.method === "POST" && lastInit.body instanceof FormData, "document creation is multipart");
const documentForm = lastInit?.body as FormData;
check(documentForm.get("document") !== null && documentForm.get("file") instanceof File
  && new Headers(lastInit?.headers).get("content-type") === null, "document multipart has named JSON field and boundary from fetch");
const documentPart = JSON.parse(String(documentForm.get("document")));
check(documentPart.description === "Member-only report" && documentPart.shortDescription === undefined,
  "document description uses actual contract field");
await client.updateDocument("document-1", { availableFrom: null, memberId: null, status: "Available" });
check(lastInit?.method === "PATCH" && typeof lastInit.body === "string"
  && JSON.parse(lastInit.body).availableFrom === null
  && JSON.parse(lastInit.body).targetMemberId === null, "document PATCH is JSON and preserves null clears");
await expectServiceError(() => client.updateDocument("document-1", {
  title: "No file replacement",
  file: uploadFile,
} as never), "validation");
const documentStream = await client.getDocumentFileStream("document-1");
check(lastPath === "/member-admin/documents/document-1/file" && documentStream.ok, "document file uses protected stream route");

let invalidInputFetchCalled = false;
const validationClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => {
  invalidInputFetchCalled = true;
  return Response.json({});
}) as typeof fetch);
if (!validationClient) throw new Error("Expected client for validation test.");
await expectServiceError(() => validationClient.createDocument({
  title: "", shortDescription: "", audience: "Individual Member", documentType: "",
}, uploadFile), "validation");
await expectServiceError(() => validationClient.createNotice({
  title: "Notice", message: "message", audience: "All Members", attachment: new File(["x"], "x.exe"),
}), "validation");
await expectServiceError(() => validationClient.listNotices({ pageSize: 101 }), "validation");
check(!invalidInputFetchCalled, "invalid data, files, and pagination are rejected before fetch");

const failedClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => new Response("sensitive upstream details", { status: 503 })) as typeof fetch);
if (!failedClient) throw new Error("Expected client for HTTP error test.");
await expectServiceError(() => failedClient.listRequests(), "http", 503);
await expectServiceError(() => failedClient.listRequests(), "http", 503);
const unauthorizedClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "do-not-leak-this",
}, (async () => new Response("Bearer do-not-leak-this", { status: 401 })) as typeof fetch);
if (!unauthorizedClient) throw new Error("Expected client for authorization test.");
await expectServiceError(() => unauthorizedClient.listRequests(), "http", 401);

const malformedClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => Response.json({ requests: [{ id: "incomplete" }], page: 1, pageSize: 25, total: 1 })) as typeof fetch);
if (!malformedClient) throw new Error("Expected client for response validation test.");
await expectServiceError(() => malformedClient.listRequests(), "invalid_response");

const invalidStreamClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => new Response("bytes", { headers: { "content-type": "text/html" } })) as typeof fetch);
if (!invalidStreamClient) throw new Error("Expected client for stream response validation.");
await expectServiceError(() => invalidStreamClient.getDocumentFileStream("document-1"), "invalid_response");

const timeoutClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key", timeoutMs: 5,
}, ((_, init) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
})) as typeof fetch);
if (!timeoutClient) throw new Error("Expected client for timeout test.");
await expectServiceError(() => timeoutClient.listRequests(), "timeout");

try {
  createMemberAppAdminClient({ baseUrl: "http://member.example.test", serviceKey: "key" }, fetch);
  throw new Error("Expected insecure API URL to be rejected.");
} catch (error) {
  check(error instanceof MemberAppServiceError && error.code === "invalid_configuration", "client rejects non-HTTPS API URLs");
}

console.info(JSON.stringify({ script: "check-member-app-admin", assertions }));