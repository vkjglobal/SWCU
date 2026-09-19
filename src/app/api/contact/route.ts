import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { handleContactPost } from "@/lib/contact";

export async function POST(request: Request) {
  const tenant = await resolveTenant(request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "", { allowDevelopmentFallback: false });
  if (!tenant) return NextResponse.json({ error: "Unknown tenant." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const result = await handleContactPost(tenant, body, forwarded ?? "unknown");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send your enquiry.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}