import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { AdminLoginForm } from "@/components/admin-login-form";
import { requireTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Staff CMS Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ "password-set"?: string }> }) {
  const hostname = (await headers()).get("host") ?? "";
  await requireTenant(hostname);
  const passwordSet = (await searchParams)["password-set"] === "1";

  return (
    <main className="grid min-h-screen place-items-center bg-soft-blue-grey px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-deep-navy/10 bg-white p-7 shadow-card sm:p-10">
        <Image
          src="/brand/swcu/swcu-logo-transparent.png"
          alt="Service Worker Credit Union"
          width={150}
          height={105}
          className="h-auto w-32"
          priority
        />
        <p className="eyebrow mt-7">Staff access only</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-deep-navy">
          SWCU Content Management
        </h1>
        {passwordSet && <p role="status" className="mt-5 rounded-lg border border-green-700/25 bg-green-50 p-3 text-sm font-semibold text-green-800">Password set successfully.</p>}
        <AdminLoginForm />
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-swcu-blue">
          Return to public website
        </Link>
      </section>
    </main>
  );
}