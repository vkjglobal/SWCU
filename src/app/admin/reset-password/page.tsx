import type { Metadata } from "next";
import { StaffResetForm } from "@/components/staff-reset-form";

export const metadata: Metadata = { title: "Set staff password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ membership?: string; token?: string }> }) {
  const params = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-soft-blue-grey px-4 py-12"><StaffResetForm membershipId={params.membership ?? ""}/></main>;
}