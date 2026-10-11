import type { NextConfig } from "next";

if (process.env.VERCEL && !process.env.JINGMIANSEN_SITE_URL?.trim()) {
  throw new Error("JINGMIANSEN_SITE_URL is required on Vercel.");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/works/demos/yucheng",
        destination: "/projects/demos/yucheng/index.html",
      },
    ];
  },
  async headers() {
    return ["/works/demos/yucheng", "/projects/demos/yucheng/index.html"].map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
