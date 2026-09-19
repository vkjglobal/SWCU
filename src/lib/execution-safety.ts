const PRODUCTION_MARKERS = [
  process.env.NODE_ENV === "production",
  process.env.APP_ENV === "production",
  process.env.APP_STAGE === "production",
  process.env.DEPLOYMENT_ENV === "production",
  process.env.REPLIT_DEPLOYMENT === "1",
  process.env.REPLIT_DEPLOYMENT === "true",
];

function isProductionLikeDatabase(value: string) {
  const normalized = value.toLowerCase();
  return /(^|[./_-])(prod|production|live)([./:_-]|$)/.test(normalized);
}

function assertSafeEnvironment(label: string, optInName: string, optInValue: string | undefined) {
  if (PRODUCTION_MARKERS.some(Boolean)) {
    throw new Error(`${label} is disabled in a production environment.`);
  }
  if (process.env.APP_STAGE?.toLowerCase().includes("prod") || process.env.DEPLOYMENT_ENV?.toLowerCase().includes("prod")) {
    throw new Error(`${label} is disabled in a production-like stage.`);
  }
  if (isProductionLikeDatabase(process.env.DATABASE_URL ?? "")) {
    throw new Error(`${label} is disabled for a production-like DATABASE_URL.`);
  }
  if (optInValue !== "true") {
    throw new Error(`${label} requires ${optInName}=true.`);
  }
}

export function assertSeedExecutionSafe() {
  assertSafeEnvironment("Database seed", "SEED_ALLOW_NON_PRODUCTION", process.env.SEED_ALLOW_NON_PRODUCTION);
}

export function assertQaExecutionSafe() {
  assertSafeEnvironment("Mutation QA", "QA_ALLOW_NON_PRODUCTION", process.env.QA_ALLOW_NON_PRODUCTION);
}