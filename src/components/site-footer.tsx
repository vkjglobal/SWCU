import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t-4 border-swcu-red bg-deep-navy text-white">
      <div className="site-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-heading text-xl font-bold">SWCU</p>
          <p className="mt-3 max-w-xs text-sm text-white/75">
            A member-owned credit union serving members and their families.
          </p>
        </div>
        <div>
          <p className="font-heading font-semibold">Member Services</p>
          <div className="mt-3 grid gap-2 text-sm text-white/75">
            <Link href="/membership-services#membership">Membership</Link>
            <Link href="/membership-services#savings">Savings</Link>
            <Link href="/membership-services#loans">Loans</Link>
          </div>
        </div>
        <div>
          <p className="font-heading font-semibold">Resources</p>
          <div className="mt-3 grid gap-2 text-sm text-white/75">
            <Link href="/forms-resources">Forms & Resources</Link>
            <Link href="/about-swcu">About SWCU</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div>
          <p className="font-heading font-semibold">Contact</p>
          <p className="mt-3 text-sm text-white/75">
            300 Waimanu Road
            <br />
            Suva, Fiji
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="site-container border-b border-white/10 py-5 text-sm leading-6 text-white/75">
          <p className="font-heading font-semibold text-white">Important Information</p>
          <p className="mt-2 max-w-4xl">
            SWCU will never ask you to disclose your password, PIN or security/verification code by email, phone, chat or through an unsolicited link. If you are unsure, contact SWCU using the contact details published on this website.
          </p>
        </div>
        <div className="site-container flex flex-col gap-3 py-5 text-sm text-white/65 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Service Worker Credit Union.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal links">
            <span>Privacy</span>
            <span>Terms of Use</span>
            <span>Accessibility</span>
            <span>Important Information</span>
          </div>
        </div>
      </div>
    </footer>
  );
}