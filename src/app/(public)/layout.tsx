import { headers } from "next/headers";
import { PublicShell } from "@/components/public-shell";
import { requireTenant } from "@/lib/tenant";
import { getActiveSiteNotice } from "@/lib/home-data";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const notice = await getActiveSiteNotice(tenant);

  return <PublicShell notice={notice}>{children}</PublicShell>;
}