import type { MetadataRoute } from "next";
import { getJingmiansenSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const isPreview = process.env.VERCEL_ENV === "preview";

  if (isPreview) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", getJingmiansenSiteUrl()).toString(),
  };
}
