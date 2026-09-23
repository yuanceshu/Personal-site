import Link from "next/link";
import { SiteMark } from "@/components/brand/SiteMark";
import { HomeNavigation, type HomeNavigationGroup } from "@/components/HomeNavigation";
import { experiments, getHomeWork, homeSections, homeWorkIds } from "@/content/home";
import { demos } from "@/content/projects/demos/catalog";

type SiteHeaderProps = {
  projectLabel?: string;
};

export function SiteHeader({ projectLabel }: SiteHeaderProps) {
  const groups: HomeNavigationGroup[] = projectLabel ? [] : homeSections.map((section) => {
    const links: HomeNavigationGroup["links"] = [];
    switch (section.id) {
      case "industry":
        links.push(...demos.map((demo) => ({ label: demo.title.split(" · ")[0], href: demo.href })),
          { label: "探索更多案例", href: getHomeWork(homeWorkIds.industry, "industry").href });
        break;
      case "experiments":
        links.push(...experiments.map((work) => {
          const metadata = getHomeWork(work.workId, "experiment");
          return { label: work.title ?? metadata.title, href: metadata.href };
        }));
        break;
      case "creation":
        links.push({ label: getHomeWork(homeWorkIds.creation, "creation").title,
          href: process.env.JINGMIANSEN_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3001", external: true });
        break;
      case "teaching":
        links.push({ label: "看看 AI 授课", href: getHomeWork(homeWorkIds.teaching, "teaching").href });
        break;
      case "thoughts":
        links.push({ label: "读几篇试试", href: "/thoughts" });
        break;
    }
    return { id: section.id, label: section.topic, title: `${section.prefix} ${section.topic}`, links };
  });

  return (
    <header className="site-header">
      <div className="site-header__inner page-shell">
        <Link className="site-header__name" href="/" aria-label="返回个人作品首页">
          <SiteMark className="site-header__mark" />
          <span className="site-header__identity--project">PERSONAL LAB</span>
        </Link>
        <span className="site-header__context">
          {projectLabel ?? "作品与学习记录"}
        </span>
        {projectLabel ? (
          <nav aria-label="主要导航">
            <Link href="/">返回首页</Link>
          </nav>
        ) : (
          <HomeNavigation groups={groups} />
        )}
      </div>
    </header>
  );
}
