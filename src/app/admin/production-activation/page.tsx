import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProductionAdminActivationForm } from "@/components/production-admin-activation-form";
import { productionAdminActivationAvailable } from "@/lib/production-admin-activation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Production Administrator activation",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ProductionAdminActivationPage() {
  const requestHeaders = await headers();
  if (!productionAdminActivationAvailable({
    host: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    forwardedProto: requestHeaders.get("x-forwarded-proto"),
  })) notFound();

  return (
    <main className="grid min-h-screen place-items-center bg-soft-blue-grey px-4 py-12">
      <ProductionAdminActivationForm />
    </main>
  );
}