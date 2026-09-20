import { open, unlink } from "node:fs/promises";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { initiateStaffPasswordReset } from "../src/lib/staff-accounts";

const required = [
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_BASE_URL",
  "BOOTSTRAP_ADMIN_OUTPUT_FILE",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required for secure Administrator setup`);
  }
}

const baseUrl = process.env.BOOTSTRAP_ADMIN_BASE_URL!;
const outputFile = process.env.BOOTSTRAP_ADMIN_OUTPUT_FILE!;
if (!/^https?:\/\/[^/]+$/i.test(baseUrl)) throw new Error("BOOTSTRAP_ADMIN_BASE_URL must be an origin without a path.");
if (!outputFile.startsWith("/tmp/")) throw new Error("BOOTSTRAP_ADMIN_OUTPUT_FILE must be a temporary path under /tmp.");

async function bootstrap() {
  const tenant = await db.tenant.findUnique({ where: { slug: "swcu" } });
  if (!tenant) {
    throw new Error("Run the SWCU tenant seed before bootstrapping an Administrator");
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL!.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME!.trim();
  if (!email || !name) throw new Error("Administrator name and email are required.");
  const context = await auth.$context;
  const existingUser = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  const user = existingUser ?? await context.internalAdapter.createUser({ name, email, emailVerified: false }, { method: "email" });
  const userId = user.id;
  const userCreated = !existingUser;

  const existingCredential = await db.account.findFirst({ where: { userId, providerId: "credential" } });
  if (!existingCredential) {
    await context.internalAdapter.createAccount({ userId, providerId: "credential", accountId: userId });
  }

  const membership = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenant.id}, 0))`;
    const existing = await tx.staffMembership.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId } } });
    if (existing?.role === "EDITOR") {
      const openDrafts = await tx.cmsDraft.count({
        where: {
          tenantId: tenant.id,
          OR: [{ createdBy: userId }, { assignedTo: userId }],
          status: { in: ["DRAFT", "WAITING_FOR_APPROVAL", "RETURNED_FOR_CHANGES"] },
        },
      });
      if (openDrafts > 0) throw new Error("Existing Editor has open drafts. Resolve them through the Administrator staff workflow before changing the role.");
    }
    const membership = existing
      ? await tx.staffMembership.update({ where: { id: existing.id }, data: { role: "ADMINISTRATOR", isActive: true } })
      : await tx.staffMembership.create({ data: { tenantId: tenant.id, userId, role: "ADMINISTRATOR", isActive: true } });
    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: userId,
        action: existing ? "OWNER_ADMINISTRATOR_ACTIVATED" : "OWNER_ADMINISTRATOR_PROVISIONED",
        targetType: "StaffMembership",
        targetId: membership.id,
        changeMetadata: { role: "ADMINISTRATOR", userCreated, credentialCreated: !existingCredential },
      },
    });
    return membership;
  });

  const handle = await open(outputFile, "wx", 0o600);
  try {
    const result = await initiateStaffPasswordReset({ tenant, actorUserId: userId, membershipId: membership.id, baseUrl });
    await handle.writeFile(`${result.resetLink}\n`, { encoding: "utf8" });
  } catch (error) {
    await handle.close();
    await unlink(outputFile).catch(() => undefined);
    throw error;
  }
  await handle.close();
  console.info("Administrator access is ready. The one-time setup link was written to the protected temporary output file.");
}

bootstrap()
  .finally(async () => db.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed");
    process.exitCode = 1;
  });