export function getJingmiansenSiteUrl() {
  const configured = process.env.JINGMIANSEN_SITE_URL?.trim();
  if (configured) return new URL(configured);

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelUrl) return new URL(`https://${vercelUrl}`);

  return new URL("http://localhost:3001");
}
