import { NextRequest, NextResponse } from "next/server";
import {
  activateProductionAdministrator,
  productionAdminActivationAvailable,
} from "@/lib/production-admin-activation";
import {
  clearProductionActivationFailures,
  productionActivationAllowed,
  recordProductionActivationFailure,
} from "@/lib/production-activation-throttle";
import { normalizedActivationIp } from "@/lib/production-activation-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Activation could not be completed.";
const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
};

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: SECURITY_HEADERS });
}

function requestContext(request: NextRequest) {
  return {
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    origin: request.headers.get("origin"),
  };
}

export async function POST(request: NextRequest) {
  const context = requestContext(request);
  if (!productionAdminActivationAvailable(context)) {
    return json({ error: GENERIC_ERROR }, 404);
  }

  const ip = normalizedActivationIp(
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"),
  );
  try {
    if (!(await productionActivationAllowed(ip))) {
      return json({ error: GENERIC_ERROR }, 400);
    }

    const body = await request.json() as { secret?: unknown };
    const secret = typeof body.secret === "string" && body.secret.length <= 512 ? body.secret : "";
    if (!secret) {
      await recordProductionActivationFailure(ip);
      return json({ error: GENERIC_ERROR }, 400);
    }

    const result = await activateProductionAdministrator({ secret, ...context });
    await clearProductionActivationFailures(ip);
    return json({ resetLink: result.resetLink }, 200);
  } catch {
    await recordProductionActivationFailure(ip).catch(() => undefined);
    return json({ error: GENERIC_ERROR }, 400);
  }
}