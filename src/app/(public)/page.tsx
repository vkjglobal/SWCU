import { HomeExperience } from "@/components/home-experience";
import { getHomeData } from "@/lib/home-data";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { buildPublicMetadata } from "./metadata";
import { getMemberAppHref } from "@/lib/public-links";
import { getServiceDestination } from "@/lib/service-links";

export async function generateMetadata() { return buildPublicMetadata((await headers()).get("host") ?? "", "/", "Service Worker Credit Union | SWCU", "Service Worker Credit Union website with membership information, member services, forms and contact details."); }

export default async function HomePage() {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const data = await getHomeData(tenant);
  return (
    <HomeExperience
      heroSlides={data.heroSlides.map((slide) => ({
        id: slide.id,
        alt: slide.altText,
        src: slide.mediaAsset ? `/api/media/${slide.mediaAsset.id}` : undefined,
      }))}
      memberApp={{
        enabled: data.homeSettings?.memberAppEnabled ?? true,
        label: data.homeSettings?.memberAppLabel ?? "Member App — Coming Soon",
        href: getMemberAppHref(data.tenantSettings),
      }}
      highlights={data.highlights.map((item) => ({ value: item.value, label: item.label }))}
      services={data.services.map((item) => ({
        title: item.title,
        description: item.description,
        icon: item.icon,
        href: getServiceDestination(item.title, item.destination),
      }))}
      forms={data.forms.map((item) => ({
        title: item.title,
        href: item.mediaAsset && !item.mediaAsset.retiredAt ? `/api/media/${item.mediaAsset.id}` : undefined,
      }))}
      news={data.news.map((item) => ({
        title: item.title,
        date: item.publishedAt ? item.publishedAt.toLocaleDateString("en-FJ", { year: "numeric", month: "short", day: "numeric" }) : "",
        excerpt: item.summary ?? "",
      }))}
      faqs={data.faqs.map((item) => ({ question: item.question, answer: item.answer }))}
      contact={data.contact ? {
        organisationName: data.contact.organisationName,
        streetAddress: data.contact.streetAddress,
        postalAddress: data.contact.postalAddress,
        telephone: data.contact.telephone,
        publicEmail: data.contact.publicEmail,
      } : undefined}
    />
  );
}