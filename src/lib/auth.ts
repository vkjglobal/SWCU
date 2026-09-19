import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";

const environment = getServerEnvironment();

export const auth = betterAuth({
  appName: "SWCU Staff CMS",
  baseURL: environment.BETTER_AUTH_URL,
  secret: environment.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  advanced: {
    useSecureCookies: environment.NODE_ENV === "production",
  },
});