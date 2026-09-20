import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Member App Coming Soon" },
  robots: { index: false, follow: false },
};

export default function MemberLoginPage() {
  return (
    <section className="route-placeholder">
      <div className="site-container">
        <p className="eyebrow">Member App</p>
        <h1>Your SWCU. Wherever you are.</h1>
        <p className="max-w-2xl text-lg">
          The SWCU Member App is coming soon. Until then, you can use this website
          for SWCU information, forms and contact details.
        </p>
        <Link href="/" className="button-primary mt-7">
          Return to the SWCU website
        </Link>
      </div>
    </section>
  );
}