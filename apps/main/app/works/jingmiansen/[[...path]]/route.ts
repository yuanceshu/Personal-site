const destinationByPath: Record<string, string> = {
  "": "/",
  lingmian: "/",
  "xing-yue-xiang-hu": "/xing-yue-xiang-hu",
  "witch-train": "/witch-train",
  "rainy-night-cafe": "/rainy-night-cafe",
  "rainy-night-cafe/xing-yue-xiang-hu": "/xing-yue-xiang-hu",
};

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function getSiteUrl() {
  return (
    process.env.JINGMIANSEN_SITE_URL?.trim().replace(/\/$/, "") ??
    "http://localhost:3001"
  );
}

async function redirectToJingmiansen(_request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  const destination = destinationByPath[path.join("/")] ?? "/";

  return new Response(null, {
    status: 308,
    headers: {
      Location: new URL(destination, `${getSiteUrl()}/`).toString(),
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const GET = redirectToJingmiansen;
export const HEAD = redirectToJingmiansen;
