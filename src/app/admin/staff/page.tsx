import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { createStaffAccountAction, changeStaffRoleAction, setStaffActiveAction } from "@/app/admin/actions";
import { AdminShell, StatusBadge } from "@/app/admin/admin-shell";
import { StaffResetInitiation } from "@/components/staff-reset-initiation";

const openStatuses = ["DRAFT", "WAITING_FOR_APPROVAL", "RETURNED_FOR_CHANGES"] as const;

export default async function StaffPage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { membership } = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const staff = await db.staffMembership.findMany({
    where: { tenantId: tenant.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
  const editorIds = staff.filter((item) => item.role === "EDITOR").map((item) => item.userId);
  const editors = staff.filter((item) => item.role === "EDITOR" && item.isActive);
  const openDrafts = await db.cmsDraft.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: [...openStatuses] },
      OR: [{ createdBy: { in: editorIds } }, { assignedTo: { in: editorIds } }],
    },
    select: { id: true, kind: true, status: true, createdBy: true, assignedTo: true },
    orderBy: { createdAt: "asc" },
  });

  return <AdminShell role={membership.role} title="Staff accounts" intro="Manage who can prepare and approve public content. Passwords are never shown here.">
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
        <h2 className="font-heading text-xl font-bold text-deep-navy">Add a staff account</h2>
        <p className="mt-2 text-sm text-charcoal/65">Use a temporary setup password. The staff member can sign in and change it through the supported account process.</p>
        <form action={createStaffAccountAction} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Name<input name="name" required className="mt-1 w-full rounded-lg border border-deep-navy/15 px-3 py-2"/></label>
          <label className="block text-sm font-semibold">Email<input name="email" type="email" required className="mt-1 w-full rounded-lg border border-deep-navy/15 px-3 py-2"/></label>
          <label className="block text-sm font-semibold">Temporary setup password<input name="password" type="password" minLength={8} required className="mt-1 w-full rounded-lg border border-deep-navy/15 px-3 py-2"/></label>
          <label className="block text-sm font-semibold">Role<select name="role" className="mt-1 w-full rounded-lg border border-deep-navy/15 px-3 py-2"><option value="EDITOR">Editor</option><option value="ADMINISTRATOR">Administrator</option></select></label>
          <button className="button-primary" type="submit">Create account</button>
        </form>
        <p className="mt-4 text-sm text-charcoal/60">For an existing staff member, an Administrator can start the supported password reset process below. No passwords are displayed here.</p>
      </section>
      <section className="rounded-card border border-deep-navy/10 bg-white p-6 shadow-card">
        <h2 className="font-heading text-xl font-bold text-deep-navy">Current staff</h2>
        <div className="mt-4 space-y-3">
          {staff.map((item) => {
            const affectedDrafts = item.role === "EDITOR"
              ? openDrafts.filter((draft) => draft.createdBy === item.userId || draft.assignedTo === item.userId)
              : [];
            const needsDecision = item.role === "EDITOR" && affectedDrafts.length > 0;
            return <div key={item.id} className="rounded-lg border border-deep-navy/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold text-deep-navy">{item.user.name}</p><p className="text-sm text-charcoal/65">{item.user.email}</p></div>
                <StatusBadge status={item.isActive ? "ACTIVE" : "DISABLED"}/>
              </div>
              {needsDecision && <div className="mt-3 rounded-lg bg-soft-blue-grey p-3">
                <p className="text-sm font-semibold text-deep-navy">Deal with {affectedDrafts.length} open draft{affectedDrafts.length === 1 ? "" : "s"} {item.isActive ? "before disabling" : "while this Editor is disabled"}.</p>
                <ul className="mt-2 space-y-1 text-xs text-charcoal/70">{affectedDrafts.map((draft) => <li key={draft.id}>{draft.kind.replaceAll("_", " ")} · {draft.status.replaceAll("_", " ")}</li>)}</ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={setStaffActiveAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="membershipId" value={item.id}/>
                    <input type="hidden" name="isActive" value="false"/>
                    <input type="hidden" name="decision" value="REASSIGN"/>
                    <label className="sr-only" htmlFor={`replacement-${item.id}`}>Replacement Editor</label>
                    <select id={`replacement-${item.id}`} name="assigneeUserId" required aria-label={`Replacement Editor for ${item.user.name}`} className="rounded-lg border border-deep-navy/15 px-2 py-1 text-sm">
                      <option value="">Choose replacement Editor</option>
                      {editors.filter((editor) => editor.userId !== item.userId).map((editor) => <option key={editor.userId} value={editor.userId}>{editor.user.name}</option>)}
                    </select>
                    <button className="rounded-lg border border-swcu-red/30 px-3 py-1 text-sm font-semibold text-swcu-red" type="submit">Reassign and disable</button>
                  </form>
                  <form action={setStaffActiveAction}>
                    <input type="hidden" name="membershipId" value={item.id}/>
                    <input type="hidden" name="isActive" value="false"/>
                    <input type="hidden" name="decision" value="ARCHIVE"/>
                    <button className="rounded-lg border border-deep-navy/20 px-3 py-1 text-sm font-semibold text-charcoal" type="submit">Archive drafts and disable</button>
                  </form>
                </div>
              </div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <StaffResetInitiation membershipId={item.id}/>
                <form action={changeStaffRoleAction}>
                  <input type="hidden" name="membershipId" value={item.id}/>
                  <select name="role" defaultValue={item.role} aria-label={`Role for ${item.user.name}`} className="rounded-lg border border-deep-navy/15 px-2 py-1 text-sm"><option value="EDITOR">Editor</option><option value="ADMINISTRATOR">Administrator</option></select>
                  <button className="ml-2 rounded-lg border border-swcu-blue/30 px-3 py-1 text-sm font-semibold text-swcu-blue" type="submit">Save role</button>
                </form>
                {!needsDecision && <form action={setStaffActiveAction}>
                  <input type="hidden" name="membershipId" value={item.id}/>
                  <input type="hidden" name="isActive" value={item.isActive ? "false" : "true"}/>
                  <button className="rounded-lg border border-deep-navy/15 px-3 py-1 text-sm font-semibold text-charcoal" type="submit">{item.isActive ? "Disable access" : "Reactivate"}</button>
                </form>}
              </div>
            </div>;
          })}
        </div>
      </section>
    </div>
  </AdminShell>;
}