import Link from "next/link";

export function RoutePlaceholder({
  eyebrow,
  title,
  summary,
}: {
  eyebrow: string;
  title: string;
  summary: string;
}) {
  return (
    <section className="route-placeholder">
      <div className="site-container">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="max-w-2xl text-lg">{summary}</p>
        <p className="mt-8 rounded-xl border border-swcu-blue/20 bg-white p-5 text-sm text-charcoal/75 shadow-card">
          This route is established for Prompt 1. Final page content will be added only
          when its controlled build stage is authorised.
        </p>
        <Link href="/" className="button-secondary mt-6">
          Return home
        </Link>
      </div>
    </section>
  );
}