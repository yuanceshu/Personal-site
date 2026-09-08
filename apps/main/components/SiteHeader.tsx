import Link from "next/link";
import { SiteMark } from "@/components/brand/SiteMark";

type SiteHeaderProps = {
  projectLabel?: string;
};

export function SiteHeader({ projectLabel }: SiteHeaderProps) {
  const jingmiansenUrl =
    process.env.JINGMIANSEN_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3001";

  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <Link className="site-header__name" href="/" aria-label="返回袁策书的个人作品首页">
          <SiteMark className="site-header__mark" />
          <span>袁策书</span>
        </Link>
        <span className="site-header__context">
          {projectLabel ?? "作品与学习记录"}
        </span>
        <nav aria-label="主要导航">
          {projectLabel ? (
            <Link href="/">返回首页</Link>
          ) : (
            <>
              <Link href="#work">作品</Link>
              <a href={jingmiansenUrl} referrerPolicy="no-referrer">
                静眠森
              </a>
              <Link href="#about">认识我</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
