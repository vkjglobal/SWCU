import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { clearStaffLoginFailures, recordStaffLoginFailure, staffLoginAllowed, STAFF_LOGIN_GENERIC_ERROR } from "@/lib/login-throttle";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
const handler = toNextJsHandler(auth);
export const GET = handler.GET;

export async function POST(request: NextRequest) {
  if (!request.nextUrl.pathname.endsWith("/sign-in/email")) return handler.POST(request);
  let body: { email?: unknown; password?: unknown };
  try { body = await request.clone().json() as { email?: unknown; password?: unknown }; } catch { return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 }); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? undefined;
  if (!email || !(await staffLoginAllowed(email, ip))) return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
  const response = await handler.POST(request);
  if (response.ok) await clearStaffLoginFailures(email, ip);
  else {
    await recordStaffLoginFailure(email, ip);
    return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
  }
  return response;
}