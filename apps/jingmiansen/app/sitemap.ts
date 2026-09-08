import type { MetadataRoute } from "next";
import { getJingmiansenSiteUrl } from "@/lib/site-url";

const paths = [
  "",
  "/xing-yue-xiang-hu",
  "/witch-train",
  "/rainy-night-cafe",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getJingmiansenSiteUrl();

  return paths.map((path, index) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: "monthly",
    priority: index === 0 ? 1 : 0.8,
  }));
}
