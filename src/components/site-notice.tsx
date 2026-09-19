import Link from "next/link";

type Notice = { message: string; actionText: string | null; actionUrl: string | null };

export function SiteNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return <aside className="border-b border-swcu-blue/20 bg-soft-blue-grey" aria-label="Site notice"><div className="site-container flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-deep-navy"><p className="font-medium">{notice.message}</p>{notice.actionText && notice.actionUrl ? <Link href={notice.actionUrl} className="font-bold text-swcu-blue underline underline-offset-2">{notice.actionText}</Link> : null}</div></aside>;
}