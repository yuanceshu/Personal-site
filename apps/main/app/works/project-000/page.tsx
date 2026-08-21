import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "../../../styles/projects/project-000.css";
import { PublicAccountCard } from "@/components/PublicAccountCard";
import { CityReleaseLog } from "@/components/works/project-000/CityReleaseLog";
import { CourseTimeline } from "@/components/works/project-000/CourseTimeline";
import { EvidenceDisclosure } from "@/components/works/project-000/EvidenceDisclosure";
import { PromptExperience } from "@/components/works/project-000/PromptExperience";
import { SiteHeader } from "@/components/SiteHeader";
import {
  collaborators,
  designCases,
  projectFacts,
  reusableAssets,
  scopeDecisions,
  shortcomings,
  workScenes,
} from "@/content/projects/project-000";

export const metadata: Metadata = {
  title: "把一门 AI 培训课，当成产品来设计",
  description:
    "从近 160 小时研发到四地 339 名学员：一次关于用户问题、范围取舍、体验设计与持续迭代的课程产品化案例。",
};

const chapters = [
  ["01", "先体验", "#experience"],
  ["02", "问题与判断", "#judgment"],
  ["03", "体验设计", "#design"],
  ["04", "四次发生", "#releases"],
  ["05", "证据与反思", "#reflection"],
] as const;

export default function Project000Page() {
  return (
    <>
      <SiteHeader projectLabel="作品 / 000" />
      <main className="project-page">
        <section className="project-hero page-shell" aria-labelledby="project-title">
          <div className="project-hero__topline">
            <span>PROJECT 000 · PRODUCT CASE</span>
            <span>2026.03—06</span>
          </div>
          <div className="project-hero__grid">
            <div className="project-hero__copy">
              <p className="eyebrow">AI TRAINING AS A PRODUCT</p>
              <h1 id="project-title">
                把一门 AI 培训课，
                <span>当成产品来设计</span>
              </h1>
              <p className="project-hero__question">
                如何让一群 AI 基础不同的普通员工，在三个半小时后，真的愿意把 AI 用进明天的工作？
              </p>
              <div className="project-hero__role" aria-label="我在项目中的角色">
                <span>我的角色</span>
                <p>课程组长 · 产品设计 · 内容整合 · 四地授课</p>
              </div>
            </div>
            <figure className="project-hero__media">
              <Image
                src="/projects/project-000/shanxi-classroom.jpg"
                alt="山西站 AI 课程现场，学员在会场参加培训"
                fill
                priority
                sizes="(max-width: 760px) 100vw, 48vw"
              />
              <figcaption>山西 · 第三次发生 · 2026.04.27</figcaption>
            </figure>
          </div>
          <dl className="hero-facts">
            {projectFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="project-hero__actions">
            <a className="primary-link" href="#experience">
              先体验一个关键差别 <span aria-hidden="true">↓</span>
            </a>
            <span>从一个具体工作场景开始</span>
          </div>
        </section>

        <nav className="project-nav" aria-label="案例章节">
          <div className="page-shell">
            {chapters.map(([index, label, href]) => (
              <a href={href} key={href}>
                <span>{index}</span>
                {label}
              </a>
            ))}
          </div>
        </nav>

        <section className="experience-section section-pad" id="experience" aria-labelledby="experience-title">
          <div className="narrow-shell">
            <p className="eyebrow">60 秒体验 · 课程里的一个方法</p>
            <h2 id="experience-title" className="section-title">
              为什么你问 AI，
              <br />
              总得到一堆“正确的废话”？
            </h2>
            <p className="section-intro">
              很多人不是没用过 AI，而是用过一次以后，发现它说得面面俱到，却没有一句能直接拿去工作。
            </p>
            <PromptExperience />
            <EvidenceDisclosure label="课程来源" title="这个方法原本就出现在课上">
              <div className="evidence-inline">
                <div>
                  <p>
                    “需求 + 场景 + 约束”来自最终课程课件第 32 页。这里先用一个固定示例把差别展示出来，再把方法带回真实工作场景。
                  </p>
                </div>
                <figure className="evidence-inline__image">
                  <Image
                    src="/projects/project-000/course/prompt-method.jpg"
                    alt="课程课件中需求、场景、约束的提示词方法"
                    fill
                    sizes="(max-width: 720px) 100vw, 36vw"
                  />
                </figure>
              </div>
            </EvidenceDisclosure>
          </div>
        </section>

        <section className="judgment-section section-pad page-shell" id="judgment" aria-labelledby="judgment-title">
          <div className="section-index">02 / 问题与判断</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">START WITH THE REAL JOB</p>
              <h2 id="judgment-title" className="section-title">
                真正难的，不是把 AI 讲完，而是让人明天愿意用一次。
              </h2>
            </div>
            <div className="prose-large">
              <p>
                学员来自一线业务、产品、运营和综合管理岗位，AI 基础并不相同。共同的阻力是：AI 很热，却和每天打开的文档、表格、会议与客户问题隔着一层。
              </p>
              <p>
                所以课程目标不再是“系统讲完 AI”，而是让每个人看见场景、掌握一种可迁移的方法，并知道哪些信息仍然需要自己判断。
              </p>
            </div>
          </div>

          <ol className="scene-grid">
            {workScenes.map((scene, index) => (
              <li key={scene.title}>
                <span>0{index + 1}</span>
                <strong>{scene.title}</strong>
                <p>{scene.detail}</p>
              </li>
            ))}
          </ol>

          <div className="decision-board">
            <div className="decision-board__intro">
              <p className="eyebrow">THE DECISIONS BEHIND THE EXPERIENCE</p>
              <h3>课程还没开始，最重要的工作已经发生了。</h3>
              <p>目标、伙伴和时间，决定了最后课堂里能留下什么。</p>
            </div>
            <div className="decision-grid">
              {scopeDecisions.map((decision) => (
                <article key={decision.title}>
                  <span>{decision.label}</span>
                  <h4>{decision.title}</h4>
                  <p>{decision.reason}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="judgment-evidence">
            <div>
              <CourseTimeline />
              <EvidenceDisclosure label="过程记录" title="第一次试讲后，时间被重新分配">
                <p>
                  早期大纲把 3.5 小时粗分为讲授与互动。随着试讲和素材到位，最终版重新组织成 10、40、85、25、50 分钟五段，练习和表达被保留在课程里。
                </p>
              </EvidenceDisclosure>
            </div>
            <figure className="scope-evidence__image">
              <Image
                src="/projects/project-000/course-timeline-upright.jpg"
                alt="四地授课前手写的课程时间节点，文字方向已校正"
                fill
                sizes="(max-width: 760px) 100vw, 42vw"
              />
              <figcaption>每一场开始前，都重新写一张时间节点表。</figcaption>
            </figure>
          </div>

          <div className="collaboration-note">
            <div>
              <p className="eyebrow">PEOPLE WITH REAL SCENES</p>
              <h3>我没有一个人把课讲完。</h3>
              <p>正式开会前，我先逐一沟通，再让每个人把最熟悉的工作带进课堂。</p>
            </div>
            <div className="collaborator-grid">
              {collaborators.map((person) => (
                <article key={person.name}>
                  <span>{person.role}</span>
                  <h3>{person.name}</h3>
                  <p>{person.contribution}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="delivery-system">
            <div>
              <p className="eyebrow">MY WAY OF DELIVERING</p>
              <h3>把不擅长临场发挥，变成一套可靠的准备方式。</h3>
            </div>
            <ol>
              <li><span>01</span><p>向有经验的内训师请教互动设计。</p></li>
              <li><span>02</span><p>用完整录屏试讲，而不是只翻一遍课件。</p></li>
              <li><span>03</span><p>逐字稿写到语气、停顿和音调，再反复演练。</p></li>
              <li><span>04</span><p>素材到位后，再集中整合与制作。</p></li>
            </ol>
          </div>
        </section>

        <section className="design-section section-pad" id="design" aria-labelledby="design-title">
          <div className="page-shell">
            <div className="section-index">03 / 体验设计</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">DESIGN THE ENERGY, NOT ONLY THE SLIDES</p>
                <h2 id="design-title" className="section-title">
                  工具是内容，注意力、情绪和行动才是体验。
                </h2>
              </div>
              <p className="prose-large">
                三个半小时里，学员不可能一直保持同一种注意力。课程因此有意识地在观看、理解、跟做、讨论和表达之间切换。
              </p>
            </div>
            <div className="design-cases">
              {designCases.map((item, index) => (
                <article className={`design-case design-case--${index + 1}`} key={item.title}>
                  <div className="design-case__copy">
                    <span>{item.index}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  {index === 0 && (
                    <figure>
                      <Image
                        src="/projects/project-000/course/old-zhao.jpg"
                        alt="课程中的老赵的一天故事画面"
                        fill
                        sizes="(max-width: 760px) 100vw, 52vw"
                      />
                      <figcaption>先从一个忙乱的工作日开始。</figcaption>
                    </figure>
                  )}
                  {index === 1 && (
                    <div className="teacher-voices" aria-label="三位一线老师的内容分工">
                      <span>内部工具</span>
                      <span>文字场景</span>
                      <span>数据处理</span>
                      <p>真正做过的人，进入真实课程。</p>
                    </div>
                  )}
                  {index === 2 && (
                    <figure>
                      <Image
                        src="/projects/project-000/course/office-challenge.jpg"
                        alt="课程后半程的 AI 办公任务挑战课件"
                        fill
                        sizes="(max-width: 760px) 100vw, 42vw"
                      />
                      <figcaption>后半程从继续听，切换到自己做。</figcaption>
                    </figure>
                  )}
                </article>
              ))}
            </div>
            <div className="props-story">
              <figure>
                <Image
                  src="/projects/project-000/classroom-props.jpg"
                  alt="课程中使用的加分卡、奖状与实物道具"
                  fill
                  sizes="(max-width: 760px) 100vw, 38vw"
                />
              </figure>
              <div>
                <p className="eyebrow">SMALL DETAILS, SAME INTENTION</p>
                <h3>我也把 AI 用进了课堂的细节里。</h3>
                <p>
                  学员共同写提示词生成中场音乐；同一首歌在结尾“音乐传物”中再次出现。加分卡、奖状与感言卡也使用 AI 辅助设计，让课程从内容到道具保持同一种体验语言。
                </p>
                <p className="evidence-note">这些细节负责恢复精力和建立记忆，但从不抢走学习主线。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="releases-section section-pad page-shell" id="releases" aria-labelledby="releases-title">
          <div className="section-index">04 / 四次发生</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">SAME COURSE, DIFFERENT ROOM</p>
              <h2 id="releases-title" className="section-title">
                同一门课，四次都不一样。
              </h2>
            </div>
            <p className="prose-large">
              每一场都留下一个观察，再变成下一场能执行的修改：时间、语言、反馈机制、内容新鲜度与讲授状态。
            </p>
          </div>
          <CityReleaseLog />
        </section>

        <section className="reflection-section section-pad" id="reflection" aria-labelledby="reflection-title">
          <div className="page-shell">
            <div className="section-index">05 / 证据与反思</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">WHAT STAYED AFTER THE CLASS</p>
                <h2 id="reflection-title" className="section-title">
                  课程结束后，真正留下了什么？
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  四场课能证明有人开始动手、反馈推动了下一场调整；它还不能证明长期效率提升。于是我把具体观察、留下的资产和仍然不够好的地方放在一起。
                </p>
              </div>
            </div>

            <div className="outcome-grid">
              <article className="outcome-card outcome-card--quote">
                <span>课堂里发生的一件小事</span>
                <blockquote>“我刚才下载试了一下，真被震到了。”</blockquote>
                <p>山西场，一位学员在介绍语音输入后现场下载并体验。</p>
              </article>
              <figure className="outcome-card outcome-card--image">
                <Image
                  src="/projects/project-000/course/feedback-cards-clear.jpg"
                  alt="山西站课程结束后收集的多张手写感言卡"
                  fill
                  sizes="(max-width: 760px) 100vw, 42vw"
                />
                <figcaption>从第三场开始，课后多了一张感言卡，把没来得及说出口的反馈也留下来。</figcaption>
              </figure>
              <article className="outcome-card outcome-card--assets">
                <span>课程结束后留下的东西</span>
                <ul>
                  {reusableAssets.map((asset) => <li key={asset}>{asset}</li>)}
                </ul>
              </article>
            </div>

            <div className="shortcomings">
              <h3>如果再做一轮，我会先改这四件事</h3>
              <ol>
                {shortcomings.map((item, index) => (
                  <li key={item}>
                    <span>0{index + 1}</span>
                    <p>{item}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="project-closing narrow-shell">
              <p className="final-reflection">
                后来我意识到，让我频繁进入心流的，并不只是站在台上讲课。真正让我着迷的，是把一个复杂、模糊的问题，一点点重新设计成别人可以真实经历的东西。
              </p>
              <p className="closing-line">
                希望 AI 不只是教室里的三个半小时，而是真正住进大家每天打开电脑后的第一个动作里。
              </p>
              <PublicAccountCard compact />
              <div className="reflection-actions">
                <Link className="back-link" href="/">
                  <span aria-hidden="true">←</span> 回到首页，继续认识我
                </Link>
                <a className="back-link back-link--quiet" href="#experience">
                  再看一次核心体验 <span aria-hidden="true">↑</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
