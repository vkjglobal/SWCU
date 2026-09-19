import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <RoutePlaceholder
      eyebrow="Contact"
      title="Contact Service Worker Credit Union"
      summary="The public contact route is ready. Confirmed contact details, map information and the protected enquiry workflow will be added in a later authorised stage."
    />
  );
}