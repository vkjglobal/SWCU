import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { ContactError, handleContactPost } from "@/lib/contact";
import { contactOriginAllowed, contactRequestHost, contactSourceAddress, readContactJson } from "@/lib/contact-request";

export async function POST(request: Request) {
  const canonicalHost = contactRequestHost(request.headers);
  if (!canonicalHost) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const tenant = await resolveTenant(canonicalHost);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant." }, { status: 404 });
  if (!contactOriginAllowed(request.headers, canonicalHost)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const body = await readContactJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request.");
    if ("website" in body && body.website !== "") {
      return NextResponse.json({ error: "Unable to send your enquiry." }, { status: 400 });
    }
    const result = await handleContactPost(tenant, body, contactSourceAddress(request.headers), canonicalHost.split(":")[0]);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send your enquiry.";
    const status = error instanceof ContactError ? error.status :
      error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}