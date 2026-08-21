import Link from "next/link";

type SiteHeaderProps = {
  projectLabel?: string;
};

export function SiteHeader({ projectLabel }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <Link className="site-header__name" href="/" aria-label="返回袁策书的个人作品首页">
          袁策书
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
              <Link href="#about">认识我</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
