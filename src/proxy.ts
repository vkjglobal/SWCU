import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant";

export async function proxy(request: NextRequest) {
  const tenant = await resolveTenant(request.headers.get("host") ?? "");

  if (!tenant) {
    return new NextResponse("Site not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    request.nextUrl.pathname !== "/admin/login" &&
    !hasSessionCookie
  ) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/).*)"],
};