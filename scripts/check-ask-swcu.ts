import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASK_SWCU_CONNECTION_READY, ASK_SWCU_NOT_READY_MESSAGE, planAskSwcuChange, shouldRenderAskSwcu } from "../src/lib/ask-swcu-policy";
import { AskSwcuWidget } from "../src/components/ask-swcu-widget";
import { saveAskSwcuVisibility } from "../src/lib/ask-swcu-settings";
import type { db } from "../src/lib/db";

const source = (path: string) => readFileSync(path, "utf8");
let assertions = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  assertions++;
}

check(ASK_SWCU_CONNECTION_READY === false, "connection is not ready by default");
check(planAskSwcuChange(false, false, false) === null, "OFF remains OFF without a connection");
assert.throws(() => planAskSwcuChange(false, true, false), { message: ASK_SWCU_NOT_READY_MESSAGE });
assertions++;
assert.throws(() => planAskSwcuChange(true, true, false), { message: ASK_SWCU_NOT_READY_MESSAGE });
assertions++;
assert.deepEqual(planAskSwcuChange(true, false, false), { before: true, after: false });
assertions++;
assert.deepEqual(planAskSwcuChange(false, true, true), { before: false, after: true });
assertions++;
check(!shouldRenderAskSwcu(false, false) && !shouldRenderAskSwcu(false, true) && !shouldRenderAskSwcu(true, false), "OFF or disconnected means no public widget");
check(shouldRenderAskSwcu(true, true), "a future connected, enabled assistant may render");
check(AskSwcuWidget({ enabled: false }) === null && AskSwcuWidget({ enabled: true }) === null, "public widget has no placeholder");

const auditRecords: unknown[] = [];
let savedValue: boolean | undefined;
const fakeDatabase = {
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    tenantSettings: {
      findUnique: async () => ({ showAskSwcu: true }),
      upsert: async (args: { update: { showAskSwcu: boolean } }) => {
        savedValue = args.update.showAskSwcu;
        return { id: "settings-test" };
      },
    },
    auditLog: { create: async (args: { data: unknown }) => { auditRecords.push(args.data); } },
  }),
} as unknown as Pick<typeof db, "$transaction">;
await saveAskSwcuVisibility({
  tenantId: "tenant-test",
  organisationName: "Test organisation",
  actorUserId: "admin-test",
  requested: false,
}, fakeDatabase);
check(savedValue === false, "valid OFF transition persists");
assert.deepEqual(auditRecords, [{
  tenantId: "tenant-test",
  actorUserId: "admin-test",
  action: "ASK_SWCU_VISIBILITY_CHANGED",
  targetType: "TenantSettings",
  targetId: "settings-test",
  changeMetadata: { before: true, after: false },
}]);
assertions++;
await assert.rejects(saveAskSwcuVisibility({
  tenantId: "tenant-test",
  organisationName: "Test organisation",
  actorUserId: "admin-test",
  requested: true,
}, fakeDatabase), { message: ASK_SWCU_NOT_READY_MESSAGE });
check(auditRecords.length === 1, "rejected ON does not write or audit");

const schema = source("prisma/schema.prisma");
const migration = source("prisma/migrations/20260928090000_ask_swcu_visibility/migration.sql");
check(/showAskSwcu\s+Boolean\s+@default\(false\)/.test(schema) && migration.includes('"showAskSwcu" BOOLEAN NOT NULL DEFAULT false'), "tenant settings default OFF in schema and migration");
const page = source("src/app/admin/ask-swcu/page.tsx");
const action = source("src/app/admin/ask-swcu/actions.ts");
const storage = source("src/lib/ask-swcu-settings.ts");
const nav = source("src/app/admin/admin-shell.tsx");
const dashboard = source("src/app/admin/page.tsx");
const layout = source("src/app/(public)/layout.tsx");
const widget = source("src/components/ask-swcu-widget.tsx");
check(page.includes('requireStaffMembership(tenant, ["ADMINISTRATOR"])'), "only Administrator reaches the page; Editor, Viewer and public are denied");
check(action.includes('requireStaffMembership(tenant, ["ADMINISTRATOR"])'), "only Administrator can call the action");
check(action.indexOf("requireStaffMembership(") < action.indexOf('formData.get("showAskSwcu")'), "action authorizes before reading settings input");
check(action.includes('value !== "on" && value !== "off"'), "action rejects unknown values");
check(nav.includes('role === "ADMINISTRATOR" && <Link href="/admin/ask-swcu"'), "navigation is Administrator-only");
check(dashboard.includes('["Ask SWCU", "/admin/ask-swcu"'), "dashboard area is present");
check(page.includes("Not connected") && page.includes("Prepared — connection pending"), "connection and Member App status are read-only");
check(page.includes("passwords, PINs, verification codes or private account information"), "public privacy reminder is shown");
check(storage.includes("planAskSwcuChange(false, input.requested, ASK_SWCU_CONNECTION_READY)") && storage.includes("if (!change) return"), "ON is rejected before writing and no-op is not audited");
check(storage.includes("tx.tenantSettings.upsert(") && storage.includes("tx.auditLog.create(") && storage.includes('action: "ASK_SWCU_VISIBILITY_CHANGED"') && storage.includes("actorUserId: input.actorUserId") && storage.includes("changeMetadata: change"), "valid setting change writes a tenant-scoped audit record with actor and old/new values");
check(layout.includes("showAskSwcu: true") && layout.includes("<AskSwcuWidget enabled={tenantSettings?.showAskSwcu ?? false} />"), "one central public insertion point uses tenant-scoped OFF-by-default setting");
check(widget.includes("bottom-24 right-4") && widget.includes("md:bottom-6 md:right-6"), "future widget position clears the mobile action bar");
check(!/<script|<iframe|https?:\/\/|fetch\(|NEXT_PUBLIC_|process\.env/i.test(widget + layout), "public integration contains no provider script, iframe, URL, API call or browser configuration");
check(!/chatling.*(key|token|id|url|script)/i.test(widget), "no Chatling secret or embed is in the public widget");

console.log(JSON.stringify({ script: "check-ask-swcu", assertions }));