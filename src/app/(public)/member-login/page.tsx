import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Member App Coming Soon",
  robots: { index: false, follow: false },
};

export default function MemberLoginPage() {
  return (
    <section className="route-placeholder">
      <div className="site-container">
        <p className="eyebrow">Member App</p>
        <h1>Your SWCU. Wherever you are.</h1>
        <p className="max-w-2xl text-lg">
          The secure SWCU Member App is a separate future project. Member account
          services are not part of this public website.
        </p>
        <Link href="/" className="button-primary mt-7">
          Return to the SWCU website
        </Link>
      </div>
    </section>
  );
}