import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({
  children,
  role,
  title,
  intro,
}: {
  children: ReactNode;
  role: "ADMINISTRATOR" | "EDITOR";
  title?: string;
  intro?: string;
}) {
  return (
    <main className="min-h-screen bg-soft-blue-grey">
      <header className="border-b border-deep-navy/10 bg-white">
        <div className="site-container flex min-h-20 flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <Link href="/admin" className="font-heading text-xl font-bold text-deep-navy">SWCU CMS</Link>
            <p className="text-sm text-charcoal/65">A clear publishing desk for staff</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-swcu-blue/10 px-3 py-1 text-sm font-semibold text-swcu-blue">
              {role === "ADMINISTRATOR" ? "Administrator" : "Editor"}
            </span>
            {role === "ADMINISTRATOR" && <Link className="text-sm font-semibold text-swcu-blue underline-offset-4 hover:underline" href="/admin/staff">Staff accounts</Link>}
          </div>
        </div>
      </header>
      <nav aria-label="Staff navigation" className="border-b border-deep-navy/10 bg-white">
        <div className="site-container flex gap-5 overflow-x-auto py-3 text-sm font-semibold text-charcoal/70">
          <Link href="/admin" className="whitespace-nowrap hover:text-swcu-blue">Overview</Link>
          <Link href="/admin/drafts" className="whitespace-nowrap hover:text-swcu-blue">My drafts</Link>
          {role === "ADMINISTRATOR" && <Link href="/admin/approvals" className="whitespace-nowrap hover:text-swcu-blue">Waiting for approval</Link>}
        </div>
      </nav>
      <section className="site-container py-10">
        {title && <><p className="eyebrow">Staff publishing</p><h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">{title}</h1>{intro && <p className="mt-3 max-w-2xl text-charcoal/70">{intro}</p>}</>}
        {children}
      </section>
    </main>
  );
}

export const kindLabels: Record<string, string> = {
  SITE_NOTICE: "Site notice", NEWS: "News and notices", FAQ: "FAQ",
  FORM_DOCUMENT: "Forms and documents", HERO: "Homepage image", MEDIA: "Media",
};
export const operationLabels: Record<string, string> = {
  CREATE: "Create", UPDATE: "Update", REMOVE: "Remove", REPLACE: "Replace",
  REORDER: "Reorder", TOGGLE: "Show or hide", UPLOAD: "Upload", RETIRE: "Retire",
};
export function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const tone = status === "PUBLISHED" ? "bg-ocean-teal/10 text-ocean-teal" : status === "RETURNED_FOR_CHANGES" ? "bg-swcu-red/10 text-swcu-red" : "bg-swcu-blue/10 text-swcu-blue";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}