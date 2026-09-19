import "server-only";

import { db } from "@/lib/db";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

export function staffLoginAttemptKey(email: string, ipAddress?: string) {
  return `${email.trim().toLowerCase()}|${ipAddress ?? "unknown"}`;
}

export async function staffLoginAllowed(email: string, ipAddress?: string, now = new Date()) {
  const attempt = await db.staffLoginAttempt.findUnique({ where: { key: staffLoginAttemptKey(email, ipAddress) } });
  if (!attempt) return true;
  if (attempt.blockedUntil && attempt.blockedUntil > now) return false;
  return now.getTime() - attempt.windowStart.getTime() >= WINDOW_MS || attempt.failures < MAX_FAILURES;
}

export async function recordStaffLoginFailure(email: string, ipAddress?: string, now = new Date()) {
  const key = staffLoginAttemptKey(email, ipAddress);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const previous = await tx.staffLoginAttempt.findUnique({ where: { key } });
    const inWindow = previous && now.getTime() - previous.windowStart.getTime() < WINDOW_MS;
    const failures = inWindow ? previous.failures + 1 : 1;
    const attempt = await tx.staffLoginAttempt.upsert({
      where: { key },
      update: { email: email.trim().toLowerCase(), ipAddress, failures, windowStart: inWindow ? previous.windowStart : now, blockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + BLOCK_MS) : null },
      create: { key, email: email.trim().toLowerCase(), ipAddress, failures, windowStart: now, blockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + BLOCK_MS) : null },
    });
    return Boolean(attempt.blockedUntil && attempt.blockedUntil > now);
  });
}

export async function clearStaffLoginFailures(email: string, ipAddress?: string) {
  await db.staffLoginAttempt.deleteMany({ where: { key: staffLoginAttemptKey(email, ipAddress) } });
}

export const STAFF_LOGIN_GENERIC_ERROR = "The email or password was not recognised.";