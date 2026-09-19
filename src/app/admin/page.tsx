import { headers } from "next/headers";
import { requireStaffMembership } from "@/lib/authorise";
import { requireTenant } from "@/lib/tenant";

const futureModules = [
  "Site Notice",
  "News & Notices",
  "Forms & Documents",
  "Website Images",
  "FAQs",
  "Leadership",
];

export default async function AdminDashboardPage() {
  const hostname = (await headers()).get("host") ?? "";
  const tenant = await requireTenant(hostname);
  const { membership } = await requireStaffMembership(tenant);

  return (
    <main className="min-h-screen bg-soft-blue-grey">
      <header className="border-b border-deep-navy/10 bg-white">
        <div className="site-container flex min-h-20 items-center justify-between">
          <div>
            <p className="font-heading text-xl font-bold text-deep-navy">SWCU CMS</p>
            <p className="text-sm text-charcoal/65">Foundation dashboard</p>
          </div>
          <span className="rounded-full bg-swcu-blue/10 px-3 py-1 text-sm font-semibold text-swcu-blue">
            {membership.role === "ADMINISTRATOR" ? "Administrator" : "Editor"}
          </span>
        </div>
      </header>
      <section className="site-container py-12">
        <p className="eyebrow">Protected staff area</p>
        <h1 className="mt-2 font-heading text-4xl font-bold text-deep-navy">
          Content tools will be added in later controlled stages.
        </h1>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {futureModules.map((module) => (
            <div
              key={module}
              className="rounded-card border border-deep-navy/10 bg-white p-5 shadow-card"
            >
              <p className="font-heading font-semibold text-deep-navy">{module}</p>
              <p className="mt-2 text-sm text-charcoal/65">Not yet enabled</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}