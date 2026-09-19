"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <section className="route-placeholder"><div className="site-container"><p className="eyebrow">SWCU website</p><h1>We could not load this page</h1><p className="max-w-xl text-lg text-charcoal/75">Please try again. If the problem continues, return to the homepage or contact SWCU using the published details.</p><div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={reset} className="button-primary">Try again</button><Link href="/" className="button-secondary">Return home</Link></div></div></section>;
}