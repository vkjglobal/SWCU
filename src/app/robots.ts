import type { MetadataRoute } from "next";
import { getServerEnvironment } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getServerEnvironment().BETTER_AUTH_URL?.replace(/\/$/, "") ?? "https://www.swcu.finance";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/about-swcu", "/membership-services", "/forms-resources", "/contact"], disallow: ["/admin", "/api", "/member-login", "/_next", "/private", "/drafts"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}