import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { PrismaClient } from "../src/generated/prisma/client";

const required = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_PASSWORD",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required for the one-time Administrator bootstrap`);
  }
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const bootstrapAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: false },
});

async function bootstrap() {
  const tenant = await db.tenant.findUnique({ where: { slug: "swcu" } });
  if (!tenant) {
    throw new Error("Run the SWCU tenant seed before bootstrapping an Administrator");
  }

  const existingAdministrators = await db.staffMembership.count({
    where: { tenantId: tenant.id, role: "ADMINISTRATOR", isActive: true },
  });

  if (existingAdministrators > 0) {
    throw new Error("Administrator bootstrap refused: an active Administrator already exists");
  }

  const result = await bootstrapAuth.api.signUpEmail({
    body: {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL!,
      name: process.env.BOOTSTRAP_ADMIN_NAME!,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD!,
    },
  });

  await db.$transaction([
    db.staffMembership.create({
      data: {
        tenantId: tenant.id,
        userId: result.user.id,
        role: "ADMINISTRATOR",
      },
    }),
    db.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: result.user.id,
        action: "ADMINISTRATOR_BOOTSTRAPPED",
        targetType: "User",
        targetId: result.user.id,
      },
    }),
  ]);

  console.info("The first SWCU Administrator was created.");
}

bootstrap()
  .finally(async () => db.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed");
    process.exitCode = 1;
  });