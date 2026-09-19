import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";
import { db } from "@/lib/db";
import { CmsDraftStatus } from "@/generated/prisma/client";
import { AdminDraftQueue } from "@/components/admin-draft-queue";

type DraftField = { label: string; value: string };
type DraftPayload = Record<string, unknown>;

function payloadValue(payload: DraftPayload, key: string) {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("at")) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-FJ");
  }
  return String(value).slice(0, 240);
}

function fields(payload: DraftPayload, keys: [string, string][]): DraftField[] {
  return keys.map(([key, label]) => ({ label, value: payloadValue(payload, key) }));
}

async function describeDraft(tenantId: string, draft: Awaited<ReturnType<typeof db.cmsDraft.findMany>>[number]) {
  const payload = (draft.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload) ? draft.payload : {}) as DraftPayload;
  let current: DraftField[] = [];
  let proposed: DraftField[] = [];
  let media: { id: string; filename: string; mimeType: string } | undefined;

  if (draft.kind === "SITE_NOTICE") {
    const record = await db.siteNotice.findUnique({ where: { tenantId } });
    current = record ? fields(record, [["message", "Message"], ["actionText", "Action text"], ["actionUrl", "Action URL"], ["isEnabled", "Enabled"], ["startsAt", "Starts"], ["endsAt", "Ends"]]) : [{ label: "Record", value: "None" }];
    proposed = fields(payload, [["message", "Message"], ["actionText", "Action text"], ["actionUrl", "Action URL"], ["isEnabled", "Enabled"], ["startsAt", "Starts"], ["endsAt", "Ends"]]);
  } else if (draft.kind === "NEWS") {
    const record = draft.targetId ? await db.newsNotice.findFirst({ where: { id: draft.targetId, tenantId } }) : null;
    current = record ? fields(record, [["title", "Title"], ["summary", "Summary"], ["publishedAt", "Published at"], ["isPublished", "Published"]]) : [{ label: "Record", value: "None" }];
    proposed = fields(payload, [["title", "Title"], ["summary", "Summary"], ["publishedAt", "Published at"], ["isPublished", "Published"]]);
  } else if (draft.kind === "FAQ") {
    const record = draft.targetId ? await db.fAQ.findFirst({ where: { id: draft.targetId, tenantId } }) : null;
    current = record ? fields(record, [["question", "Question"], ["answer", "Answer"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]) : [{ label: "Record", value: "None" }];
    proposed = fields(payload, [["question", "Question"], ["answer", "Answer"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]);
  } else if (draft.kind === "FORM_DOCUMENT") {
    const record = draft.targetId ? await db.formDocument.findFirst({ where: { id: draft.targetId, tenantId }, include: { mediaAsset: { select: { id: true, originalFilename: true, mimeType: true } } } }) : null;
    current = record ? fields(record, [["title", "Title"], ["description", "Description"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]) : [{ label: "Record", value: "None" }];
    proposed = fields(payload, [["title", "Title"], ["description", "Description"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]);
    const mediaId = String(payload.mediaAssetId ?? draft.mediaAssetId ?? "");
    if (mediaId) {
      const asset = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId }, select: { id: true, originalFilename: true, mimeType: true } });
      if (asset) media = { id: asset.id, filename: asset.originalFilename, mimeType: asset.mimeType };
    }
    if (record?.mediaAsset) current.push({ label: "PDF", value: `${record.mediaAsset.originalFilename} (${record.mediaAsset.mimeType})` });
  } else if (draft.kind === "HERO") {
    const record = draft.targetId ? await db.homeHeroSlide.findFirst({ where: { id: draft.targetId, tenantId }, include: { mediaAsset: { select: { id: true, originalFilename: true, mimeType: true } } } }) : null;
    current = record ? fields(record, [["altText", "Alt text"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]) : [{ label: "Record", value: "None" }];
    proposed = fields(payload, [["altText", "Alt text"], ["sortOrder", "Order"], ["isEnabled", "Enabled"]]);
    const mediaId = String(payload.mediaAssetId ?? draft.mediaAssetId ?? "");
    if (mediaId) {
      const asset = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId }, select: { id: true, originalFilename: true, mimeType: true } });
      if (asset) media = { id: asset.id, filename: asset.originalFilename, mimeType: asset.mimeType };
    }
    if (record?.mediaAsset) current.push({ label: "Image", value: `${record.mediaAsset.originalFilename} (${record.mediaAsset.mimeType})` });
  } else if (draft.kind === "MEDIA") {
    const currentAsset = draft.targetId ? await db.mediaAsset.findFirst({ where: { id: draft.targetId, tenantId }, select: { id: true, originalFilename: true, mimeType: true } }) : null;
    current = currentAsset ? [{ label: "File", value: `${currentAsset.originalFilename} (${currentAsset.mimeType})` }] : [{ label: "File", value: "None" }];
    proposed = fields(payload, [["purpose", "Purpose"]]);
    const mediaId = String(payload.mediaAssetId ?? draft.mediaAssetId ?? "");
    if (mediaId) {
      const asset = await db.mediaAsset.findFirst({ where: { id: mediaId, tenantId }, select: { id: true, originalFilename: true, mimeType: true } });
      if (asset) media = { id: asset.id, filename: asset.originalFilename, mimeType: asset.mimeType };
    }
  }
  return { current, proposed, media };
}

const modules = [
  ["Homepage", "/admin/homepage", "Hero, highlights and services"],
  ["Site Notice", "/admin/site-notice", "Sitewide scheduled message"],
  ["Forms & Documents", "/admin/forms", "Approved member downloads"],
  ["News & Notices", "/admin/news", "Publish public updates"],
  ["FAQs", "/admin/faqs", "Common member questions"],
  ["Contact Details", "/admin/contact", "Central public contact source"],
  ["Media Library", "/admin/media", "Upload, replace and retire images"],
];

export default async function AdminDashboardPage() {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const { membership } = await requireStaffMembership(tenant);
  const [heroCount, serviceCount, faqCount, drafts] = await Promise.all([
    db.homeHeroSlide.count({ where: { tenantId: tenant.id } }),
    db.service.count({ where: { tenantId: tenant.id } }),
    db.fAQ.count({ where: { tenantId: tenant.id } }),
    membership.role === "ADMINISTRATOR"
      ? db.cmsDraft.findMany({
          where: { tenantId: tenant.id, status: CmsDraftStatus.DRAFT },
          include: { creator: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const draftSummaries = membership.role === "ADMINISTRATOR"
    ? await Promise.all(drafts.map(async (draft) => ({
        id: draft.id,
        kind: draft.kind,
        operation: draft.operation,
        targetId: draft.targetId,
        createdAt: draft.createdAt.toISOString(),
        creator: draft.creator.name || draft.creator.email,
        ...(await describeDraft(tenant.id, draft)),
      })))
    : [];

  return (
    <main className="min-h-screen bg-soft-blue-grey">
      <header className="border-b border-deep-navy/10 bg-white">
        <div className="site-container flex min-h-20 items-center justify-between">
          <div>
            <p className="font-heading text-xl font-bold text-deep-navy">SWCU CMS</p>
          <p className="text-sm text-charcoal/65">Homepage content workspace</p>
          </div>
          <span className="rounded-full bg-swcu-blue/10 px-3 py-1 text-sm font-semibold text-swcu-blue">
            {membership.role === "ADMINISTRATOR" ? "Administrator" : "Editor"}
          </span>
        </div>
      </header>
      <section className="site-container py-12">
        <p className="eyebrow">Protected staff area</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">
          Keep SWCU content clear, useful and up to date.
        </h1>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([module, href, description]) => (
            <a key={module} href={href} className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-swcu-blue/30">
              <p className="font-heading font-semibold text-deep-navy">{module}</p>
              <p className="mt-2 text-sm text-charcoal/65">{description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-swcu-blue">Open module →</span>
            </a>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3 text-sm text-charcoal/65">
          <span>{heroCount} hero slides</span><span>·</span><span>{serviceCount} services</span><span>·</span><span>{faqCount} FAQs</span>
        </div>
        {membership.role === "ADMINISTRATOR" && (
          <AdminDraftQueue drafts={draftSummaries} />
        )}
      </section>
    </main>
  );
}