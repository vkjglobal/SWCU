import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNotice } from "@/components/site-notice";

type Notice = { message: string; actionText: string | null; actionUrl: string | null };

export function PublicShell({ children, notice }: { children: React.ReactNode; notice: Notice | null }) {
  return (
    <>
      <SiteHeader />
      <SiteNotice notice={notice} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}