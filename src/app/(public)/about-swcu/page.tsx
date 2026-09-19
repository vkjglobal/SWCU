import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata: Metadata = { title: "About SWCU" };

export default function AboutPage() {
  return (
    <RoutePlaceholder
      eyebrow="About SWCU"
      title="Our story, purpose and leadership"
      summary="The route and shared page shell are ready. Approved history, governance, leadership and report content will be added in the authorised supporting-pages stage."
    />
  );
}