import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "产品、AI 与持续成长｜PERSONAL LAB",
    template: "%s｜PERSONAL LAB",
  },
  description:
    "我是袁策书，在金融行业做产品与售前，喜欢 AI、心理学，也持续记录工作、学习与作品。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
