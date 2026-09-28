import { NextResponse } from "next/server";
import { requireStaffMembership } from "@/lib/authorise";
import { getMemberAppAdminClient, type MemberAppAdminClient } from "@/lib/member-app-admin";
import { resolveTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StreamClient = MemberAppAdminClient & {
  getRequestAttachmentStream(id: string, attachmentId: string): Promise<Response>;
};

function validId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,200}$/.test(value);
}

function streamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const safeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  headers.set("Content-Type", contentType && safeTypes.has(contentType) ? contentType : "application/octet-stream");

  const disposition = upstream.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  const plainName = disposition.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  let filename = "";
  try {
    filename = encodedName ? decodeURIComponent(encodedName.trim()) : (plainName?.[1] ?? plainName?.[2] ?? "").trim();
  } catch {
    filename = "";
  }
  filename = filename
    .replace(/[\/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f"]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .trim()
    .slice(0, 180);
  headers.set("Content-Disposition", filename ? `attachment; filename="${filename}"` : "attachment");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const tenant = await resolveTenant(request.headers.get("host") ?? "");
  if (!tenant) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const access = await requireStaffMembership(tenant, ["ADMINISTRATOR"]);
  const { id, attachmentId } = await context.params;
  if (!validId(id) || !validId(attachmentId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const client = getMemberAppAdminClient(tenant, access.session.user.id);
  if (!client) return NextResponse.json({ error: "Member App service unavailable." }, { status: 503 });

  try {
    const upstream = await (client as StreamClient).getRequestAttachmentStream(id, attachmentId);
    if (!upstream.ok) {
      return NextResponse.json(
        { error: upstream.status === 404 ? "Not found." : "Unable to retrieve this file." },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }
    if (!upstream.body) {
      return NextResponse.json({ error: "Unable to retrieve this file." }, { status: 502 });
    }
    return new Response(upstream.body, { status: 200, headers: streamHeaders(upstream) });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
    return NextResponse.json(
      { error: status === 404 ? "Not found." : "Unable to retrieve this file." },
      { status: status === 404 ? 404 : 502 },
    );
  }
}