import type { NextConfig } from "next";

if (process.env.VERCEL && !process.env.JINGMIANSEN_SITE_URL?.trim()) {
  throw new Error("JINGMIANSEN_SITE_URL is required on Vercel.");
}

const nextConfig: NextConfig = {};

export default nextConfig;
