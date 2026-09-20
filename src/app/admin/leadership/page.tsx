import Link from "next/link";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { db } from "@/lib/db";
import { saveLeadershipAction, updateLeadershipAction } from "../actions";
import { AdminActionForm, AdminSubmitButton } from "@/components/admin-action-form";

export default async function LeadershipPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const people = await db.leadershipRecord.findMany({ where: { tenantId: tenant.id }, orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
  return <main className="site-container py-12">
    <Link href="/admin">← Dashboard</Link>
    <h1 className="mt-8 font-heading text-4xl font-bold text-deep-navy">Leadership & Committees</h1>
    <p className="mt-2 text-charcoal/70">Add only approved names and profiles. Records remain unpublished until reviewed.</p>
    <AdminActionForm action={saveLeadershipAction} className="mt-8 grid max-w-3xl gap-3 rounded-card bg-white p-6 sm:grid-cols-2" successMessage="Leadership record saved.">
      {["name", "title", "group", "profile", "sortOrder"].map((name) => <label key={name} className="text-sm font-semibold">{name}<input name={name} className="mt-1 w-full rounded border p-2" /></label>)}<input name="mediaAssetId" placeholder="Approved active image media ID (optional)" className="rounded border p-2"/>
      <AdminSubmitButton pendingLabel="Saving…" className="rounded bg-swcu-blue px-4 py-2 font-semibold text-white">Save unpublished record</AdminSubmitButton>
    </AdminActionForm>
    <ul className="mt-8 space-y-3">{people.map((person) => <li key={person.id} className="rounded-card bg-white p-4"><AdminActionForm action={updateLeadershipAction} className="grid gap-2 sm:grid-cols-2" successMessage="Leadership record updated."><input type="hidden" name="id" value={person.id}/>{[["name",person.name],["title",person.title],["group",person.group],["profile",person.profile ?? ""],["sortOrder",String(person.sortOrder)]].map(([name,value])=><input key={name} name={name} defaultValue={value} placeholder={name} className="rounded border p-2"/>)}<input name="mediaAssetId" defaultValue={person.mediaAssetId ?? ""} placeholder="Approved active image media ID (optional)" className="rounded border p-2"/><label><input name="isEnabled" type="checkbox" defaultChecked={person.isEnabled}/> Enabled</label><label><input name="isPublished" type="checkbox" defaultChecked={person.isPublished}/> Public release approved</label><AdminSubmitButton pendingLabel="Updating…" className="rounded bg-swcu-blue px-3 py-2 font-semibold text-white">Update record</AdminSubmitButton></AdminActionForm></li>)}</ul>
  </main>;
}