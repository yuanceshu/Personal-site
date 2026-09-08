import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/works/jingmiansen",
        destination: "/",
        permanent: true,
      },
      {
        source: "/works/jingmiansen/xing-yue-xiang-hu",
        destination: "/xing-yue-xiang-hu",
        permanent: true,
      },
      {
        source: "/works/jingmiansen/witch-train",
        destination: "/witch-train",
        permanent: true,
      },
      {
        source: "/works/jingmiansen/rainy-night-cafe",
        destination: "/rainy-night-cafe",
        permanent: true,
      },
      {
        source: "/works/jingmiansen/rainy-night-cafe/xing-yue-xiang-hu",
        destination: "/xing-yue-xiang-hu",
        permanent: true,
      },
      {
        source: "/rainy-night-cafe/xing-yue-xiang-hu",
        destination: "/xing-yue-xiang-hu",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
