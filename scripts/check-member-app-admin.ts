import {
  createMemberAppAdminClient,
  MemberAppServiceError,
} from "../src/lib/member-app-admin";

let assertions = 0;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Member App Admin assertion failed: ${message}`);
  assertions += 1;
}

function expectServiceError(
  action: () => unknown | Promise<unknown>,
  code: MemberAppServiceError["code"],
): Promise<void> {
  return Promise.resolve()
    .then(action)
    .then(() => { throw new Error(`Expected MemberAppServiceError (${code}).`); })
    .catch((error: unknown) => {
      if (!(error instanceof MemberAppServiceError) || error.code !== code) throw error;
      assertions += 1;
    });
}

const disconnected = createMemberAppAdminClient({ baseUrl: "https://member.example.test" }, fetch);
check(disconnected === null, "missing service key yields a disconnected client without fetching");
check(createMemberAppAdminClient({ serviceKey: "secret" }, fetch) === null, "missing API base URL yields a disconnected client");

let lastUrl = "";
let lastInit: RequestInit | undefined;
const requestFetch = (async (input, init) => {
  lastUrl = String(input);
  lastInit = init;
  const path = new URL(lastUrl).pathname;
  if (path.endsWith("/notices") && init?.method === "POST") return Response.json(noticeRecord);
  if (path.endsWith("/documents") && init?.method === "POST") return Response.json(documentRecord);
  if (path.endsWith("/requests")) return Response.json([]);
  if (path.endsWith("/documents")) return Response.json([]);
  if (path.endsWith("/notices")) return Response.json([]);
  if (path.endsWith("/members")) return Response.json([]);
  if (path.endsWith("/access")) return Response.json({ url: "https://private.example.test/temporary?token=short-lived" });
  if (path.endsWith("/internal-notes")) return Response.json(requestDetail);
  if (path.includes("/requests/")) return Response.json(requestDetail);
  if (path.includes("/documents/")) return Response.json(documentRecord);
  if (path.includes("/notices/")) return Response.json(noticeRecord);
  return new Response(null, { status: 404 });
}) as typeof fetch;

const client = createMemberAppAdminClient({
  baseUrl: "https://member.example.test/api/",
  serviceKey: "server-only-test-key",
  actorUserId: "staff-user-42",
}, requestFetch);
check(client !== null, "complete configuration creates a client");
if (!client) throw new Error("Expected configured Member App client.");

const requestDetail = {
  id: "request-1",
  reference: "SWCU-R-001",
  member: { id: "member-1", name: "Test Member", identifier: "M-001" },
  type: "Membership update",
  submittedAt: "2026-01-01T00:00:00.000Z",
  status: "Processing",
  updatedAt: "2026-01-01T00:00:00.000Z",
  fields: { address: "Private address" },
  attachments: [{ id: "attachment-1", name: "form.pdf" }],
  memberMessage: null,
  internalNotes: [],
  history: [],
} as const;
const noticeRecord = {
  id: "notice-1",
  title: "Notice",
  message: "Member-only message",
  audience: "All Members",
  member: null,
  attachment: null,
  showFrom: null,
  showUntil: null,
  status: "Draft",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as const;
const documentRecord = {
  id: "document-1",
  title: "Private document",
  shortDescription: "",
  audience: "All Members",
  member: null,
  documentType: "Circular",
  file: { id: "file-1", name: "document.pdf" },
  availableFrom: null,
  availableUntil: null,
  status: "Draft",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as const;

await client.listRequests({ status: "Processing", type: "Member update", search: "M-001" });
check(new URL(lastUrl).pathname === "/api/admin/requests", "requests use the central endpoint path");
check(new URL(lastUrl).searchParams.get("status") === "Processing"
  && new URL(lastUrl).searchParams.get("type") === "Member update"
  && new URL(lastUrl).searchParams.get("search") === "M-001", "request filters are query parameters");
check(lastInit?.method === "GET" && lastInit.cache === "no-store", "list operation is GET and disables caching");
check(new Headers(lastInit?.headers).get("authorization") === "Bearer server-only-test-key", "request uses bearer authorization");
check(new Headers(lastInit?.headers).get("X-Staff-Actor-ID") === "staff-user-42", "authenticated staff actor ID is forwarded for service auditing");

await client.getRequest("request with space");
check(lastUrl.endsWith("/admin/requests/request%20with%20space"), "request identifier is encoded as a path segment");
await client.updateRequest("request-1", { status: "Approved", memberMessage: "Please check the Member App." });
check(String(lastInit?.method) === "PATCH", "request update uses PATCH");
check(JSON.parse(String(lastInit?.body)).status === "Approved", "request update sends validated JSON");
await client.addInternalNote("request-1", "Staff-only note");
check(lastUrl.endsWith("/admin/requests/request-1/internal-notes") && String(lastInit?.method) === "POST", "internal note uses its dedicated endpoint");
check(lastInit?.cache === "no-store", "private mutations also disable caching");
check(await client.getAttachmentAccess("request-1", "attachment-1") === "https://private.example.test/temporary?token=short-lived", "attachment access returns a validated HTTPS URL");
await client.listNotices();
await client.getNotice("notice-1");
await client.createNotice({
  title: "Notice", message: "Member-only message", audience: "All Members", status: "Draft",
});
check(lastUrl.endsWith("/admin/notices") && String(lastInit?.method) === "POST", "notice creation uses the notices endpoint");
await client.createNotice({
  title: "Notice with private file", message: "Member-only message", audience: "All Members",
  status: "Draft", attachment: new File(["private"], "notice.pdf", { type: "application/pdf" }),
});
check(lastInit?.body instanceof FormData && (lastInit.body as FormData).get("file") instanceof File, "notice attachment is privately forwarded using multipart");
await client.updateNotice("notice-1", {
  title: "Notice", message: "Updated", audience: "All Members", status: "Active",
  showFrom: null, showUntil: null,
});
check(lastUrl.endsWith("/admin/notices/notice-1") && String(lastInit?.method) === "PATCH", "notice update uses its record endpoint");
const clearedNoticeData = JSON.parse(String(lastInit?.body)) as Record<string, unknown>;
check(clearedNoticeData.showFrom === null && clearedNoticeData.showUntil === null, "notice update forwards explicit null schedule values");
await client.updateNotice("notice-1", {
  title: "Notice", message: "Updated", audience: "All Members", status: "Active",
  showFrom: null, showUntil: null,
  attachment: new File(["private update"], "notice-update.pdf", { type: "application/pdf" }),
});
check(lastInit?.body instanceof FormData && (lastInit.body as FormData).get("file") instanceof File, "notice update supports private multipart attachment replacement");
const noticeMultipartData = JSON.parse(String((lastInit?.body as FormData).get("data"))) as Record<string, unknown>;
check(noticeMultipartData.showFrom === null && noticeMultipartData.showUntil === null, "notice multipart metadata preserves null schedule values");
await client.searchMembers("Member one");
check(new URL(lastUrl).searchParams.get("search") === "Member one", "member lookup uses a search query");
await client.listDocuments();
await client.getDocument("document-1");

const uploadFile = new File(["private document bytes"], "annual-report.pdf", { type: "application/pdf" });
await client.createDocument({
  title: "Annual report", shortDescription: "Member-only report", audience: "All Members",
  documentType: "Annual Report", status: "Draft",
}, uploadFile);
check(lastUrl.endsWith("/admin/documents") && String(lastInit?.method) === "POST", "document upload is forwarded to Member App");
check(lastInit?.body instanceof FormData, "document upload uses multipart FormData");
check(new Headers(lastInit?.headers).get("content-type") === null, "multipart content type boundary is supplied by fetch");
const multipart = lastInit?.body as FormData;
check(multipart.get("file") instanceof File && (multipart.get("file") as File).name === "annual-report.pdf", "private file is forwarded in multipart request");
check(JSON.parse(String(multipart.get("data"))).title === "Annual report", "document metadata accompanies its file");
await client.updateDocument("document-1", {
  title: "Annual report", shortDescription: "Revised", audience: "All Members",
  documentType: "Annual Report", status: "Available", availableFrom: null, availableUntil: null,
});
check(String(lastInit?.method) === "PATCH" && typeof lastInit.body === "string", "document metadata update supports JSON without an upload");
const clearedDocumentData = JSON.parse(String(lastInit?.body)) as Record<string, unknown>;
check(clearedDocumentData.availableFrom === null && clearedDocumentData.availableUntil === null, "document update forwards explicit null availability values");
await client.updateDocument("document-1", {
  title: "Annual report", shortDescription: "Revised", audience: "All Members",
  documentType: "Annual Report", status: "Available", availableFrom: null, availableUntil: null,
}, uploadFile);
const documentMultipartData = JSON.parse(String((lastInit?.body as FormData).get("data"))) as Record<string, unknown>;
check(documentMultipartData.availableFrom === null && documentMultipartData.availableUntil === null, "document multipart metadata preserves null availability values");

let invalidInputFetchCalled = false;
const invalidInputClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => {
  invalidInputFetchCalled = true;
  return Response.json([]);
}) as typeof fetch);
if (!invalidInputClient) throw new Error("Expected client for validation test.");
await expectServiceError(
  () => invalidInputClient.createDocument({
    title: "", shortDescription: "", audience: "Individual Member", documentType: "",
    status: "invalid" as "Draft",
  }, uploadFile),
  "validation",
);
await expectServiceError(
  () => invalidInputClient.createDocument({
    title: "Valid", shortDescription: "", audience: "All Members", documentType: "Circular", status: "Draft",
  }, undefined as unknown as File),
  "validation",
);
check(!invalidInputFetchCalled, "invalid data and missing files are rejected before fetch");

const failedClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => new Response("sensitive upstream details", { status: 503 })) as typeof fetch);
if (!failedClient) throw new Error("Expected client for HTTP error test.");
try {
  await failedClient.listRequests();
  throw new Error("Expected HTTP service error.");
} catch (error) {
  check(error instanceof MemberAppServiceError && error.code === "http" && error.status === 503, "HTTP errors expose a safe status and code");
  check(error instanceof Error && !error.message.includes("sensitive upstream details"), "upstream response body is never exposed");
}

const malformedClient = createMemberAppAdminClient({
  baseUrl: "https://member.example.test", serviceKey: "key",
}, (async () => Response.json([{ id: "incomplete" }])) as typeof fetch);
if (!malformedClient) throw new Error("Expected client for response validation test.");
await expectServiceError(() => malformedClient.listRequests(), "invalid_response");

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
  check(error instanceof MemberAppServiceError && error.code === "invalid_configuration", "client rejects non-HTTPS API base URLs");
}

console.info(JSON.stringify({ script: "check-member-app-admin", assertions }));