import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  clearStaffLoginFailures,
  recordStaffLoginFailure,
  staffLoginAllowed,
  STAFF_LOGIN_GENERIC_ERROR,
} from "@/lib/login-throttle";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json() as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? undefined;
  if (!email || !password || !(await staffLoginAllowed(email, ip))) {
    return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
  }

  try {
    const authResponse = await auth.api.signInEmail({
      body: { email, password, rememberMe: false },
      headers: request.headers,
      asResponse: true,
    });
    if (!authResponse.ok) {
      await recordStaffLoginFailure(email, ip);
      return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
    }
    await clearStaffLoginFailures(email, ip);
    return authResponse;
  } catch {
    await recordStaffLoginFailure(email, ip);
    return NextResponse.json({ error: STAFF_LOGIN_GENERIC_ERROR }, { status: 401 });
  }
}