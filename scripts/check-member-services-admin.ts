import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let assertions = 0;

function check(condition: unknown, message: string): asserts condition {
  assert.ok(condition, message);
  assertions += 1;
}

function source(path: string): string {
  const fullPath = join(root, path);
  check(existsSync(fullPath), `source exists: ${path}`);
  return readFileSync(fullPath, "utf8");
}

const adminPages = [
  "src/app/admin/member-requests/page.tsx",
  "src/app/admin/member-requests/[id]/page.tsx",
  "src/app/admin/member-notices/page.tsx",
  "src/app/admin/member-notices/new/page.tsx",
  "src/app/admin/member-notices/[id]/page.tsx",
  "src/app/admin/member-documents/page.tsx",
  "src/app/admin/member-documents/new/page.tsx",
  "src/app/admin/member-documents/[id]/page.tsx",
];

for (const path of adminPages) {
  const page = source(path);
  check(page.includes("requireTenant("), `${path} resolves the request tenant`);
  check(
    /requireStaffMembership\(tenant,\s*\["ADMINISTRATOR"\]\)/.test(page),
    `${path} explicitly requires Administrator membership`,
  );
}

const actionsPath = "src/app/admin/member-services/actions.ts";
const actions = source(actionsPath);
check(
  /requireStaffMembership\(tenant,\s*\["ADMINISTRATOR"\]\)/.test(actions),
  "server action authorization is restricted to Administrators",
);
check(
  /getMemberAppAdminClient\(tenant,\s*session\.user\.id\)/.test(actions),
  "Member App adapter receives the authenticated staff actor",
);
check(
  actions.indexOf("requireTenant(") < actions.indexOf("requireStaffMembership(")
    && actions.indexOf("requireStaffMembership(") < actions.indexOf("getMemberAppAdminClient("),
  "actions resolve tenant and authorize before creating the adapter",
);

const actionExpectations = new Map<string, string[]>([
  ["updateMemberRequestAction", ["updateRequest"]],
  ["addMemberInternalNoteAction", ["addInternalNote"]],
  ["openMemberAttachmentAction", ["getAttachmentAccess"]],
  ["searchMemberTargetsAction", ["searchMembers"]],
  ["saveMemberNoticeAction", ["createNotice", "updateNotice"]],
  ["saveMemberDocumentAction", ["createDocument", "updateDocument"]],
]);
for (const [name, adapterCalls] of actionExpectations) {
  const functionStart = actions.indexOf(`export async function ${name}(`);
  check(functionStart >= 0, `${name} is exported`);
  const nextExport = actions.indexOf("\nexport async function ", functionStart + 1);
  const body = actions.slice(functionStart, nextExport < 0 ? undefined : nextExport);
  const authorizedClient = body.indexOf("getAuthorizedClient()");
  check(authorizedClient >= 0, `${name} authorizes before its service operation`);
  for (const adapterCall of adapterCalls) {
    const serviceCall = body.indexOf(`client.${adapterCall}(`);
    check(
      serviceCall > authorizedClient,
      `${name} authorizes before delegating ${adapterCall}`,
    );
  }
}

const requestActionStart = actions.indexOf("export async function updateMemberRequestAction(");
const requestActionEnd = actions.indexOf("\nexport async function ", requestActionStart + 1);
const requestAction = actions.slice(requestActionStart, requestActionEnd);
check(
  requestAction.includes('formData.get("changeMemberMessage") === "on"')
    && requestAction.includes("...(changeMemberMessage ? { memberMessage: readText(formData, \"memberMessage\") } : {})")
    && requestAction.includes("...(changeMemberMessage ? { memberMessage: values.memberMessage } : {})"),
  "request action only sends memberMessage when the explicit checkbox is checked, including an empty value",
);

const memberSearchStart = actions.indexOf("export async function searchMemberTargetsAction(");
const memberSearchEnd = actions.indexOf("\nexport async function ", memberSearchStart + 1);
const memberSearchAction = actions.slice(memberSearchStart, memberSearchEnd);
check(
  memberSearchAction.includes(".min(2).max(80)")
    && memberSearchAction.includes("Member search is unavailable. Please try again.")
    && memberSearchAction.includes("client.searchMembers(parsedQuery.data)"),
  "member target search validates bounds and returns only a generic service error",
);
check(
  actions.includes("if (value === null) return undefined;") && actions.includes('if (value === "") return null;')
    && actions.includes("showFrom: z.string().nullable().optional()")
    && actions.includes("availableFrom: z.string().nullable().optional()")
    && actions.includes("showFrom: values.showFrom } : {})")
    && actions.includes("availableFrom: values.availableFrom } : {})")
    && actions.includes("start !== null && end !== undefined && end !== null"),
  "notice and document schedules preserve explicit clears and compare only non-null dates",
);

const memberEditors = source("src/components/member-services-editors.tsx");
for (const path of [
  "src/app/admin/member-requests/page.tsx",
  "src/app/admin/member-requests/[id]/page.tsx",
  "src/app/admin/member-notices/page.tsx",
  "src/app/admin/member-notices/new/page.tsx",
  "src/app/admin/member-notices/[id]/page.tsx",
  "src/app/admin/member-documents/page.tsx",
  "src/app/admin/member-documents/new/page.tsx",
  "src/app/admin/member-documents/[id]/page.tsx",
]) {
  const page = source(path);
  check(
    page.includes("MemberServiceNotice")
      || (page.includes("connected={Boolean(client)}") && memberEditors.includes("MemberServiceNotice")),
    `${path} renders a disconnected-service notice`,
  );
  if (!path.endsWith("/page.tsx") || path.includes("/new/") || path.includes("/[id]/")) {
    if (path.includes("member-notices") || path.includes("member-documents")) {
      check(page.includes("connected") || page.includes("!client"), `${path} gates editor controls while disconnected`);
    }
  }
}

const privateForm = source("src/components/member-services-private-form.tsx");
const editors = source("src/components/member-services-editors.tsx");
check(
  /disabled=\{!connected\}/.test(editors),
  "notice and document forms disable save controls when disconnected",
);
check(
  /type="file"[\s\S]*?disabled=\{!connected\}/.test(editors),
  "private file inputs are disabled when disconnected",
);
check(
  privateForm.includes("useActionState") && privateForm.includes("encType=\"multipart/form-data\""),
  "private uploads submit through the server action form",
);
for (const [path, content] of [
  ["src/components/member-services-editors.tsx", editors],
  ["src/components/member-services-private-form.tsx", privateForm],
  [actionsPath, actions],
] as const) {
  check(
    !/\b(?:AdminActionForm|MediaUploader|uploadMedia|uploadToR2|mediaAsset|R2Client)\b/.test(content),
    `${path} does not use the public media upload path`,
  );
}
check(
  actions.includes("attachment: file") && actions.includes("client.createDocument(payload, file!)"),
  "uploaded files are passed directly to the private Member App adapter",
);

const adapterCheckPath = "scripts/check-member-app-admin.ts";
const adapterCheck = source(adapterCheckPath);
check(
  adapterCheck.includes("missing service key yields a disconnected client")
    && adapterCheck.includes("missing API base URL yields a disconnected client"),
  `${adapterCheckPath} separately covers the unconfigured adapter state`,
);

console.info(JSON.stringify({
  script: "check-member-services-admin",
  assertions,
  adapterDisconnectedCoverage: "check-member-app-admin",
}));