import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readMediaObject } from "@/lib/r2";
import { requireTenant } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const { id } = await context.params;
  const asset = await db.mediaAsset.findFirst({
    where: { id, tenantId: tenant.id, retiredAt: null },
    select: { objectKey: true, mimeType: true },
  });
  if (!asset) return NextResponse.json({ error: "Media not found" }, { status: 404 });
  const object = await readMediaObject(asset.objectKey);
  if (!object.Body) return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
  const bytes = await object.Body.transformToByteArray();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}