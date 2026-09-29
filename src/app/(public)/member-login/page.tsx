import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberAppHref } from "@/lib/public-links";

export const metadata: Metadata = {
  title: { absolute: "Member Login" },
  robots: { index: false, follow: false },
};

export default function MemberLoginPage() {
  const href = getMemberAppHref();
  if (href) redirect(href);
  return (
    <section className="route-placeholder">
      <div className="site-container">
        <h1>Member login temporarily unavailable</h1>
        <p className="max-w-2xl text-lg">Please try again later or contact SWCU for assistance.</p>
      </div>
    </section>
  );
}