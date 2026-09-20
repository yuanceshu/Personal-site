import Image from "next/image";
import Link from "next/link";
import { SiteMark } from "@/components/brand/SiteMark";
import { SiteHeader } from "@/components/SiteHeader";
import { getHomeWork, homeSections, homeWorkIds, experiments, type HomeSection } from "@/content/home";
import "../styles/home.css";

/** 卡内板块标题：弱化的前缀标签 + 突出的中文主标题，保留完整可访问名称 */
function SectionTag({ section, id }: { section: HomeSection; id: string }) {
  return (
    <h2 className="home-card__tag" id={id} aria-label={section.label}>
      <span className="home-card__tag-prefix" aria-hidden="true">{section.prefix}</span>
      <span className="home-card__tag-topic" aria-hidden="true">{section.topic}</span>
    </h2>
  );
}

/** 卡内文案，按用户原始文案逐行呈现 */
function SectionLines({ lines }: { lines: readonly string[] }) {
  return (
    <p className="home-card__lines">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  );
}

export default function Home() {
  const industryWork = getHomeWork(homeWorkIds.industry, "industry");
  const teachingWork = getHomeWork(homeWorkIds.teaching, "teaching");
  const creationWork = getHomeWork(homeWorkIds.creation, "creation");
  const [industrySection, experimentsSection, creationSection, teachingSection, thoughtsSection] = homeSections;
  const jingmiansenUrl =
    process.env.JINGMIANSEN_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

  return (
    <div className="home-page">
      <a className="home-skip" href="#work">跳到作品</a>
      <main>
        <section className="morning-hero" aria-labelledby="home-title">
          <picture className="morning-hero__image">
            <source media="(max-width: 720px)" type="image/avif" srcSet="/home/morning/studio-mobile-v2.avif" />
            <source media="(max-width: 720px)" type="image/webp" srcSet="/home/morning/studio-mobile-v2.webp" />
            <source type="image/avif" srcSet="/home/morning/studio-desktop-v2.avif" />
            {/* Art-directed, pre-compressed sources; only the selected image is fetched. */}
            <img src="/home/morning/studio-desktop-v2.webp" alt="" width="1672" height="941" fetchPriority="high" loading="eager" />
          </picture>
          <div className="morning-hero__inner page-shell">
            <div className="morning-brand">
              <SiteMark className="morning-brand__mark" tone="light" />
              <span>袁策书</span>
              <span className="morning-brand__label">PERSONAL LAB</span>
            </div>
            <div className="morning-copy">
              <p className="morning-copy__greeting">你好，很高兴你能来。</p>
              <h1 id="home-title">
                <span>这里，我把好奇心</span>
                <span>变成了一些真实存在的东西。</span>
              </h1>
              <p className="morning-copy__identity">我在金融行业做产品和售前，INFJ，喜欢 AI 与心理学。</p>
              <p className="morning-copy__invitation">它记录我工作、学习、实验留下的痕迹。不追光，只生长。愿我们岁岁成长，一路同行。</p>
            </div>
            <ul className="morning-index" aria-label="接下来的内容">
              {homeSections.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} aria-label={section.label}>
                    <span className="morning-index__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="morning-index__label" aria-hidden="true">{section.label}</span>
                    <svg className="morning-index__chevron" aria-hidden="true" viewBox="0 0 12 12" fill="none">
                      <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            <a className="morning-scroll-indicator" href="#work" aria-label="继续浏览作品">
              <span className="morning-scroll-indicator__line" aria-hidden="true" />
              <span className="morning-scroll-indicator__chevron" aria-hidden="true" />
            </a>
          </div>
        </section>

        <SiteHeader />
        <div className="home-works page-shell" id="work">
          <div className="home-bento">
            <Link id="industry" className="home-card home-bento__industry" href={industryWork.href} aria-labelledby="industry-title">
              <div className="home-card__image home-bento__industry-image">
                <Image src="/projects/demos/island-travel/hero-screenshot.jpg" alt="岛见智能出行的首屏界面：山海之间的行程规划入口" fill sizes="(max-width: 800px) 100vw, (max-width: 1280px) 58vw, 700px" />
              </div>
              <div className="home-card__body">
                <SectionTag section={industrySection} id="industry-title" />
                <SectionLines lines={industrySection.lines} />
                <span className="home-entry">探索行业 Demo <span aria-hidden="true">↗</span></span>
              </div>
            </Link>

            <section id="experiments" className="home-card home-bento__experiments" aria-labelledby="experiments-title">
              <div className="home-card__body home-bento__experiments-intro">
                <SectionTag section={experimentsSection} id="experiments-title" />
                <SectionLines lines={experimentsSection.lines} />
              </div>
              <div className="home-bento__experiments-grid">
                {experiments.map((work) => {
                  const metadata = getHomeWork(work.workId, "experiment");
                  return (
                    <Link className="home-mini" key={metadata.id} href={metadata.href} aria-labelledby={`${metadata.id}-work-title`}>
                      <div className="home-mini__image">
                        <Image src={work.image} alt={work.alt} fill sizes="(max-width: 720px) 100vw, 20vw" />
                      </div>
                      <div className="home-mini__body">
                        <h3 id={`${metadata.id}-work-title`}>{work.title ?? metadata.title}</h3>
                        <p>{work.description}</p>
                        <span className="home-entry" aria-hidden="true">↗</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <a id="creation" className="home-card home-bento__forest" href={jingmiansenUrl} referrerPolicy="no-referrer" aria-labelledby="creation-title">
              <div className="home-bento__forest-image">
                <Image src="/home/morning/forest-preview.webp" alt="静眠森的森林入口，光从枝叶间落入安静的小径" fill sizes="(max-width: 800px) 100vw, 40vw" />
              </div>
              <div className="home-bento__forest-copy">
                <SectionTag section={creationSection} id="creation-title" />
                <h3>{creationWork.title}</h3>
                <SectionLines lines={creationSection.lines} />
                <span className="home-entry">走进静眠森 <span aria-hidden="true">↗</span></span>
              </div>
            </a>

            <Link id="teaching" className="home-card home-bento__teaching" href={teachingWork.href} aria-labelledby="teaching-title">
              <div className="home-card__image home-bento__teaching-image">
                <Image src="/projects/project-000/shanxi-classroom.jpg" alt="山西站 AI 课程现场，学员在教室中参与培训" fill sizes="(max-width: 800px) 100vw, 25vw" />
              </div>
              <div className="home-card__body">
                <SectionTag section={teachingSection} id="teaching-title" />
                <SectionLines lines={teachingSection.lines} />
                <p className="home-bento__facts">4 <span>城</span> · 339 <span>名学员</span> · <span>近</span> 160 <span>小时研发投入</span></p>
                <span className="home-entry">看看 AI 授课 <span aria-hidden="true">↗</span></span>
              </div>
            </Link>

            <div id="thoughts" className="home-card home-bento__thoughts" aria-labelledby="thoughts-title">
              <Link className="home-card__body" href="/thoughts" aria-labelledby="thoughts-title">
                <SectionTag section={thoughtsSection} id="thoughts-title" />
                <SectionLines lines={thoughtsSection.lines} />
                <span className="home-entry">读几篇试试 <span aria-hidden="true">↗</span></span>
              </Link>
              <div className="home-bento__thoughts-account">
                <Image src="/profile/wechat-official-account-qr-home.png" alt="小袁AI感雾公众号二维码" width={72} height={72} />
                <span>小袁AI感雾</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="site-footer page-shell"><span>PERSONAL LAB</span><span>持续学习，也持续留下痕迹。</span></footer>
    </div>
  );
}
