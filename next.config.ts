import type { NextConfig } from "next";

const allowedDevOrigins = ["127.0.0.1", process.env.REPLIT_DEV_DOMAIN].filter(
  (origin): origin is string => Boolean(origin),
);

const nextConfig: NextConfig = {
  agentRules: false,
  ...(process.env.NODE_ENV === "development" ? { allowedDevOrigins } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;