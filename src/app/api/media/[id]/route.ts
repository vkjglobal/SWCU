import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readMediaObject } from "@/lib/r2";
import { resolveTenant } from "@/lib/tenant";
import { mediaCacheControl } from "@/lib/media-cache";
import { canServeMedia } from "@/lib/media-access";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenant = await resolveTenant(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "", { allowDevelopmentFallback: false });
  if (!tenant) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  const { id } = await context.params;
  const asset = await db.mediaAsset.findFirst({
    where: { id, tenantId: tenant.id, retiredAt: null },
    select: {
      objectKey: true,
      mimeType: true,
      heroSlides: {
        where: { tenantId: tenant.id, isEnabled: true },
        select: { id: true },
        take: 1,
      },
      formDocuments: {
        where: { tenantId: tenant.id, isEnabled: true, OR: [{ isAnnualReport: false }, { isAnnualReport: true, publicApprovedAt: { not: null } }] },
        select: { id: true, isAnnualReport: true, publicApprovedAt: true },
        take: 1,
      },
      pageContent: {
        where: { tenantId: tenant.id, isPublished: true },
        select: { id: true },
        take: 1,
      },
      leadershipRecords: {
        where: { tenantId: tenant.id, isEnabled: true, isPublished: true },
        select: { id: true },
        take: 1,
      },
      contactMapSettings: {
        select: { id: true },
      },
    },
  });
  if (!asset) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  const isPublished = asset.heroSlides.length > 0 || asset.formDocuments.length > 0 || asset.pageContent.length > 0 || asset.leadershipRecords.length > 0 || Boolean(asset.contactMapSettings);
  if (!isPublished) {
    if (!request.headers.get("cookie")) return NextResponse.json({ error: "Media not found" }, { status: 404 });
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers: request.headers });
    const membership = session?.user
      ? await db.staffMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: tenant.id,
              userId: session.user.id,
            },
          },
        })
      : null;
    if (!canServeMedia({ isPublished, membershipRole: membership?.role, membershipActive: membership?.isActive })) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
  }
  const object = await readMediaObject(asset.objectKey);
  if (!object.Body) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  const bytes = await object.Body.transformToByteArray();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
       "Cache-Control": mediaCacheControl(isPublished),
      "X-Content-Type-Options": "nosniff",
    },
  });
}