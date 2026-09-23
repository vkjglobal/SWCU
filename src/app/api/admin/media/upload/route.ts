import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireTenant } from "@/lib/tenant";
import { requireStaffMembership } from "@/lib/authorise";
import { uploadDocument, uploadMedia } from "@/lib/media-service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 10 * 1024 * 1024 + 1024 * 1024) return NextResponse.json({ error: "This image is too large. Please choose an image smaller than 10 MB." }, { status: 413 });
  const tenant = await requireTenant((await headers()).get("host") ?? "");
  const access = await requireStaffMembership(tenant);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const flags = z.object({
    document: z.enum(["true", "false"]),
    profile: z.enum(["true", "false"]),
    purpose: z.enum(["hero", "news", "general", "contact-map"]),
  }).safeParse({
    document: form.get("document"),
    profile: form.get("profile"),
    purpose: form.get("purpose"),
  });
  if (!flags.success) return NextResponse.json({ error: "Invalid upload options." }, { status: 400 });
  const document = flags.data.document === "true";
  const profile = flags.data.profile === "true";
  if (document && (profile || flags.data.purpose !== "general")) return NextResponse.json({ error: "Invalid upload options." }, { status: 400 });
  if (!document && profile && flags.data.purpose !== "general") return NextResponse.json({ error: "Invalid upload options." }, { status: 400 });
  try {
    const media = document
      ? await uploadDocument({ tenant, actorUserId: access.session.user.id, file, altText: String(form.get("altText") ?? ""), staged: true })
      : await uploadMedia({
          tenant,
          actorUserId: access.session.user.id,
          file,
          purpose: flags.data.purpose,
          altText: String(form.get("altText") || "") || undefined,
          profile,
          staged: true,
          uploadClass: profile ? "profile" : flags.data.purpose,
        });
    return NextResponse.json({ mediaAssetId: media.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The upload could not be processed." }, { status: 400 });
  }
}