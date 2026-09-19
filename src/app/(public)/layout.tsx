import { headers } from "next/headers";
import { PublicShell } from "@/components/public-shell";
import { requireTenant } from "@/lib/tenant";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host") ?? "";
  await requireTenant(hostname);

  return <PublicShell>{children}</PublicShell>;
}