import type { Metadata } from "next";
import { getJingmiansenSiteUrl } from "@/lib/site-url";
import "./globals.css";

const isPreview = process.env.VERCEL_ENV === "preview";

export const metadata: Metadata = {
  metadataBase: getJingmiansenSiteUrl(),
  title: {
    default: "静眠森",
    template: "%s｜静眠森",
  },
  description:
    "由灵眠在森林与梦境的边界引路，通向星月、雨夜与魔女列车中的故事。",
  alternates: { canonical: "/" },
  robots: isPreview
    ? { index: false, follow: false, noarchive: true }
    : { index: true, follow: true },
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
