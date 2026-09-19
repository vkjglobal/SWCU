/* eslint-disable @next/next/no-img-element */
import { archiveCmsDraft, publishCmsDraft } from "@/app/admin/actions";

export type AdminDraftSummary = {
  id: string;
  kind: string;
  operation: string;
  targetId: string | null;
  createdAt: string;
  creator: string;
  current: { label: string; value: string }[];
  proposed: { label: string; value: string }[];
  media?: { id: string; filename: string; mimeType: string };
};

const kindLabels: Record<string, string> = {
  SITE_NOTICE: "Site Notice",
  NEWS: "News & Notices",
  FAQ: "FAQ",
  FORM_DOCUMENT: "Forms & Documents",
  HERO: "Homepage Hero",
  MEDIA: "Media",
};

const operationLabels: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  REPLACE: "Replace",
  REMOVE: "Remove",
  REORDER: "Reorder",
  TOGGLE: "Show/Hide",
  UPLOAD: "Upload",
  RETIRE: "Retire",
};

function FieldList({ fields }: { fields: AdminDraftSummary["current"] }) {
  return <dl className="space-y-1 text-sm">{fields.map((field) => <div key={field.label} className="flex gap-2"><dt className="font-semibold text-charcoal/70">{field.label}:</dt><dd className="min-w-0 break-words text-charcoal">{field.value}</dd></div>)}</dl>;
}

export function AdminDraftQueue({ drafts }: { drafts: AdminDraftSummary[] }) {
  return (
    <section className="mt-10 rounded-card border border-swcu-blue/20 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">Administrator review</p>
          <h2 className="mt-1 font-heading text-2xl font-bold text-deep-navy">Awaiting Approval</h2>
        </div>
        <span className="rounded-full bg-swcu-blue/10 px-3 py-1 text-sm font-semibold text-swcu-blue">
          {drafts.length} Draft{drafts.length === 1 ? "" : "s"}
        </span>
      </div>
      {drafts.length ? (
        <ul className="mt-5 space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-xl bg-soft-blue-grey p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <p className="font-semibold text-deep-navy">
                  {kindLabels[draft.kind] ?? draft.kind} · {operationLabels[draft.operation] ?? draft.operation}
                </p>
                <p className="mt-1 text-sm text-charcoal/65">
                  {draft.creator} · {new Date(draft.createdAt).toLocaleString("en-FJ")}
                  {draft.targetId ? " · Existing record" : " · New record"} · Awaiting Approval
                </p>
                </div>
                <div className="flex gap-2">
                  <form action={publishCmsDraft}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button aria-label={`Publish ${kindLabels[draft.kind] ?? draft.kind} draft`} className="rounded bg-swcu-blue px-3 py-2 text-sm font-semibold text-white">Publish</button>
                  </form>
                  <form action={archiveCmsDraft}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button aria-label={`Archive ${kindLabels[draft.kind] ?? draft.kind} draft`} className="rounded border border-deep-navy/15 px-3 py-2 text-sm font-semibold text-charcoal">Archive</button>
                  </form>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg border border-deep-navy/10 bg-white/60 p-3"><p className="mb-2 font-semibold text-deep-navy">Current published</p><FieldList fields={draft.current} /></div>
                <div className="rounded-lg border border-swcu-blue/20 bg-white p-3"><p className="mb-2 font-semibold text-deep-navy">Proposed</p><FieldList fields={draft.proposed} /></div>
              </div>
              {draft.media && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-ocean-teal/20 bg-white p-3 text-sm">
                  {draft.media.mimeType.startsWith("image/") ? <img src={`/api/media/${draft.media.id}`} alt={`Proposed ${draft.media.filename}`} className="h-16 w-20 rounded object-cover" /> : <span className="rounded bg-soft-blue-grey px-2 py-3 text-xs font-semibold text-deep-navy">PDF</span>}
                  <p><span className="font-semibold">Awaiting Approval:</span> {draft.media.filename} ({draft.media.mimeType})</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-charcoal/65">No drafts are waiting for Administrator review.</p>
      )}
    </section>
  );
}