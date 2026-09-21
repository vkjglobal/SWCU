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
    request.nextUrl.pathname !== "/admin/reset-password" &&
    request.nextUrl.pathname !== "/admin/production-activation" &&
    !hasSessionCookie
  ) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const response = NextResponse.next();
  if (
    request.nextUrl.pathname === "/admin/production-activation" ||
    request.nextUrl.pathname === "/api/admin/production-activation"
  ) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/).*)"],
};