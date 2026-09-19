import type { Metadata } from "next";

export function buildPublicMetadata(host: string, path: string, title: string, description: string): Metadata {
  const origin = host ? `https://${host}` : undefined;
  const url = origin ? `${origin}${path}` : path;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "Service Worker Credit Union" },
    twitter: { card: "summary", title, description },
  };
}