import type { Metadata } from "next";
import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata: Metadata = { title: "Membership & Services" };

export default function MembershipServicesPage() {
  return (
    <div id="membership">
      <RoutePlaceholder
        eyebrow="Membership & Services"
        title="Membership and member services"
        summary="The route is ready for later approved membership, savings, loans, retirement and death benefit content. No unconfirmed rates, fees or eligibility details are published."
      />
    </div>
  );
}