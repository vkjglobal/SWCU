import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-soft-blue-grey px-4 text-center">
      <div>
        <p className="eyebrow">Page not found</p>
        <h1 className="mt-3 font-heading text-4xl font-bold text-deep-navy">
          We could not find that SWCU page.
        </h1>
        <p className="mt-4">The site or page may not be recognised.</p>
        <Link href="/" className="button-primary mt-7">
          Go to SWCU home
        </Link>
      </div>
    </main>
  );
}