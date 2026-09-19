"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/about-swcu", label: "About SWCU" },
  { href: "/membership-services", label: "Membership & Services" },
  { href: "/forms-resources", label: "Forms & Resources" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-deep-navy/10 bg-white/95 backdrop-blur ${
        compact ? "shadow-[0_8px_24px_rgba(22,59,92,0.08)]" : ""
      }`}
    >
      <div className="site-container flex min-h-20 items-center gap-4 py-2">
        <Link href="/" aria-label="SWCU home" className="shrink-0">
          <Image
            src="/brand/swcu/swcu-logo-transparent.png"
            alt="Service Worker Credit Union"
            width={174}
            height={122}
            priority
            className={`h-auto w-[92px] transition-[width] sm:w-[118px] md:w-[150px] ${
              compact ? "lg:w-[130px]" : "lg:w-[150px]"
            }`}
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 xl:flex" aria-label="Main navigation">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-md px-3 py-2 text-sm font-semibold ${
                  active ? "text-swcu-blue" : "text-charcoal hover:text-swcu-blue"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-swcu-red" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-3">
          <div className="hidden lg:block">
            <Link
              href="/membership-services#membership"
              className="button-secondary"
            >
              Join SWCU
            </Link>
          </div>
          <Link href="/member-login" className="button-primary header-member-login">
            Member Login
          </Link>
          <button
            type="button"
            className="grid size-12 place-items-center rounded-lg border border-deep-navy/15 text-deep-navy xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          className="site-container border-t border-deep-navy/10 py-4 xl:hidden"
          aria-label="Mobile navigation"
        >
          <div className="grid gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-3 font-semibold ${
                  pathname === link.href
                    ? "bg-soft-blue-grey text-swcu-blue"
                    : "text-charcoal"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/membership-services#membership"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg border border-swcu-blue px-3 py-3 font-semibold text-swcu-blue"
            >
              Join SWCU
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}