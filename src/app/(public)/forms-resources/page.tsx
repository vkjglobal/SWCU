import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata: Metadata = { title: "Forms & Resources" };

export default function FormsResourcesPage() {
  return (
    <RoutePlaceholder
      eyebrow="Forms & Resources"
      title="Forms and helpful resources"
      summary="The route is ready for approved forms, notices, annual reports and common questions. No documents have been published in Prompt 1."
    />
  );
}