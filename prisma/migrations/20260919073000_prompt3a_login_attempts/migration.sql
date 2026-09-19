CREATE TABLE "staff_login_attempts" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "ipAddress" VARCHAR(80),
  "failures" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_login_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_login_attempts_key_key" ON "staff_login_attempts"("key");
CREATE INDEX "staff_login_attempts_email_ipAddress_idx" ON "staff_login_attempts"("email", "ipAddress");