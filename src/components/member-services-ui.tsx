import Link from "next/link";
import type { ReactNode } from "react";
import type { MemberSummary } from "@/lib/member-app-admin-contract";

export const disconnectedMessage = "Member App service is not connected yet.";

export function MemberServiceNotice({ children = disconnectedMessage }: { children?: ReactNode }) {
  return <p className="rounded-lg border border-swcu-blue/15 bg-swcu-blue/5 p-4 text-sm font-medium text-deep-navy">{children}</p>;
}

export function MemberServiceLoadError() {
  return <p role="alert" className="mt-6 rounded-lg border border-swcu-red/15 bg-white p-4 text-sm font-medium text-charcoal">We could not load this item. Please try again.</p>;
}

export function MemberServiceBadge({ status }: { status: string }) {
  const color = ["Approved", "Completed", "Active", "Available"].includes(status)
    ? "bg-ocean-teal/10 text-ocean-teal"
    : ["Declined", "Expired"].includes(status)
      ? "bg-charcoal/10 text-charcoal/75"
      : "bg-swcu-blue/10 text-swcu-blue";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{status}</span>;
}

export function MemberSummaryText({ member }: { member: MemberSummary | null }) {
  if (!member) return <>All members</>;
  return <>{member.name} <span className="text-charcoal/60">({member.identifier})</span></>;
}

export function MemberServicePageHeader({ title, intro, action }: { title: string; intro: string; action?: { href: string; label: string } }) {
  return (
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">Member Services</p><h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">{title}</h1><p className="mt-2 max-w-2xl text-charcoal/70">{intro}</p></div>
      {action && <Link href={action.href} className="button-primary">{action.label}</Link>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-deep-navy"><span>{label}</span>{children}</label>;
}

export const inputClass = "w-full rounded-lg border border-deep-navy/15 bg-white px-3 py-2.5 text-sm font-normal text-charcoal";