import Link from "next/link";
import type { ReactNode } from "react";

export function MemberLoginAction({ href, className, children, ariaLabel }: {
  href: string | null;
  className: string;
  children?: ReactNode;
  ariaLabel?: string;
}) {
  if (!href) {
    return <span className={`${className} cursor-not-allowed opacity-50`} aria-disabled="true" aria-label={ariaLabel} title="Member login temporarily unavailable">{children}</span>;
  }
  return <Link href={href} className={className} aria-label={ariaLabel}>{children}</Link>;
}