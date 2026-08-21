import Image from "next/image";
import Link from "next/link";
import { PublicAccountCard } from "@/components/PublicAccountCard";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="home-hero page-shell" aria-labelledby="home-title">
          <div className="home-hero__copy">
            <p className="eyebrow">你好，很高兴你来到这里。</p>
            <h1 id="home-title" className="display-title">
              很多事需要一点运气。
              <br />
              好在，努力会让好运更容易发生。
            </h1>
            <p className="home-hero__lead">
              我是袁策书，在金融行业做产品与售前。INFJ，喜欢 AI 与心理学，也还在认真生活、工作和学习。
            </p>
            <p className="home-hero__invitation">
              这里记录着我一路工作、学习和试验留下的作品。如果你也在认真走自己的路，愿我们做彼此的学伴——岁岁成长，一路同行。
            </p>
            <div className="home-hero__actions">
              <Link className="primary-link" href="#work">
                从一个作品开始 <span aria-hidden="true">↓</span>
              </Link>
              <Link className="quiet-link" href="#about">
                再认识我一点 <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="selected-work page-shell" id="work" aria-labelledby="work-title">
          <div className="section-heading">
            <p className="eyebrow">精选作品</p>
            <span>001</span>
          </div>

          <Link className="project-feature" href="/works/project-000">
            <div className="project-feature__image">
              <Image
                src="/projects/project-000/shanxi-classroom.jpg"
                alt="山西站 AI 课程现场，学员在教室中参与培训"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 58vw"
              />
            </div>

            <div className="project-feature__body">
              <p className="eyebrow">PROJECT 000 · AI TRAINING AS A PRODUCT</p>
              <h2 id="work-title">把一门 AI 培训课，当成产品来设计</h2>
              <p className="project-feature__question">
                如何让一群几乎不懂 AI 的普通员工，在 3.5
                小时后真的愿意开始使用 AI？
              </p>
              <dl className="compact-facts">
                <div>
                  <dt>城市</dt>
                  <dd>4 座</dd>
                </div>
                <div>
                  <dt>学员</dt>
                  <dd>339 名</dd>
                </div>
                <div>
                  <dt>研发</dt>
                  <dd>约 160 小时</dd>
                </div>
              </dl>
              <span className="text-link">
                查看完整项目 <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        </section>

        <section className="about-strip page-shell" id="about" aria-labelledby="about-title">
          <p className="eyebrow" id="about-title">
            再认识我一点
          </p>
          <div className="about-strip__content">
            <p className="about-strip__lead">
              我喜欢把模糊的问题理清楚，再把它们做成可以被真实体验的东西。
            </p>
            <dl className="about-facts">
              <div>
                <dt>现在</dt>
                <dd>金融行业，产品 / 售前</dd>
              </div>
              <div>
                <dt>持续关注</dt>
                <dd>AI、心理学与真实体验</dd>
              </div>
              <div>
                <dt>保持</dt>
                <dd>努力生活、工作和学习</dd>
              </div>
            </dl>
            <PublicAccountCard />
          </div>
        </section>
      </main>

      <footer className="site-footer page-shell">
        <span>袁策书</span>
        <span>持续学习，也持续留下作品。</span>
      </footer>
    </>
  );
}
