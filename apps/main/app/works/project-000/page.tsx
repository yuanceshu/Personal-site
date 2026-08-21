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
  ["01", "用户问题", "#problem"],
  ["02", "协作系统", "#collaboration"],
  ["03", "210 分钟", "#scope"],
  ["04", "体验设计", "#design"],
  ["05", "四次上线", "#releases"],
  ["06", "证据与反思", "#reflection"],
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
              <figcaption>山西 · 第三次上线 · 2026.04.27</figcaption>
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
            <span>主叙事约 5 分钟，证据可按需展开</span>
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
            <p className="eyebrow">60 秒体验 · 课程核心方法</p>
            <h2 id="experience-title" className="section-title">
              为什么你问 AI，
              <br />
              总得到一堆“正确的废话”？
            </h2>
            <p className="section-intro">
              很多人不是没用过 AI，而是用过一次以后，发现它说得面面俱到，却没有一句能直接拿去工作。
            </p>
            <PromptExperience />
            <EvidenceDisclosure label="来源证据" title="这不是为网页临时编的方法">
              <div className="evidence-inline">
                <div>
                  <p>
                    “需求 + 场景 + 约束”来自最终课程课件第 32 页。网页把原来的汇报例子改造成可操作体验，但没有连接真实模型，所有回答均为预置演示。
                  </p>
                  <p className="evidence-note">这样既保留课程判断，也避免把作品页做成不稳定的 AI 玩具。</p>
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

        <section className="problem-section section-pad page-shell" id="problem" aria-labelledby="problem-title">
          <div className="section-index">01 / 用户问题</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">THE REAL JOB TO BE DONE</p>
              <h2 id="problem-title" className="section-title">
                真正的问题，不是员工不知道 AI。
              </h2>
            </div>
            <div className="prose-large">
              <p>
                学员来自一线业务、产品、运营和综合管理岗位，AI 基础并不相同。共同的阻力是：AI 很热，却和每天打开的文档、表格、会议与客户问题隔着一层。
              </p>
              <p>
                所以课程目标不再是“系统讲完 AI”，而是让每个人看见场景、掌握一种可迁移的方法，并知道哪些信息不能直接交给外部工具。
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
          <div className="problem-reframe">
            <span>从</span>
            <p>“我要把多少工具讲完？”</p>
            <i aria-hidden="true">→</i>
            <span>到</span>
            <p>“学员明天会先在哪件工作里用一次？”</p>
          </div>
        </section>

        <section className="collaboration-section section-pad" id="collaboration" aria-labelledby="collaboration-title">
          <div className="page-shell">
            <div className="section-index">02 / 协作系统</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">TEAM BEFORE CONTENT</p>
                <h2 id="collaboration-title" className="section-title">
                  第一个产品决策，是先换一支真正能交付的团队。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  最初安排的成员在 AI 基础或时间投入上不适合这次任务。我主动向 HR 提出调整：这并不舒服，却比在后期用加班掩盖团队配置问题更诚实。
                </p>
                <p>
                  正式开会前，我先逐一通话，确认每个人最熟悉的场景与可投入时间，再用真实优势分工。
                </p>
              </div>
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
            <div className="delivery-system">
              <div>
                <p className="eyebrow">PERSONAL DELIVERY SYSTEM</p>
                <h3>把“不擅长临场发挥”，改造成一套可依赖的交付系统。</h3>
              </div>
              <ol>
                <li><span>01</span><p>向有经验的内训师请教互动设计。</p></li>
                <li><span>02</span><p>用完整录屏试讲，而不是只翻一遍 PPT。</p></li>
                <li><span>03</span><p>逐字稿写到语气、停顿和音调，再反复演练。</p></li>
                <li><span>04</span><p>外部脚本和操作视频到位后，再集中整合与制作。</p></li>
              </ol>
            </div>
            <EvidenceDisclosure label="过程证据" title="早期课纲与最终课程并不相同">
              <p>
                早期大纲把 3.5 小时粗分为 125 分钟讲授与 90 分钟互动。随着试讲和素材到位，最终版重新组织成 10、40、85、25、50 分钟五段。变化本身，比某一版排得多精确更能说明研发过程。
              </p>
            </EvidenceDisclosure>
          </div>
        </section>

        <section className="scope-section section-pad page-shell" id="scope" aria-labelledby="scope-title">
          <div className="section-index">03 / 210 分钟</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">SCOPE IS A PRODUCT DECISION</p>
              <h2 id="scope-title" className="section-title">
                210 分钟，装不下所有好内容。
              </h2>
            </div>
            <div className="prose-large">
              <p>
                最终结构不是把章节平均切开，而是把时间分给最重要的行为：理解一个方法、亲手练习、说出自己的场景。
              </p>
              <p>
                河南场只有 3 小时，是另做压缩后的最低版本；其余场次以 3.5 小时为标准。
              </p>
            </div>
          </div>
          <CourseTimeline />
          <div className="scope-evidence">
            <figure className="scope-evidence__image">
              <Image
                src="/projects/project-000/course-timeline-notes.jpg"
                alt="四地授课前手写的课程时间节点"
                fill
                sizes="(max-width: 760px) 100vw, 48vw"
              />
              <figcaption>每一场开始前，都重新写一张时间节点表。</figcaption>
            </figure>
            <div className="scope-decisions">
              {scopeDecisions.map((decision) => (
                <article key={decision.title}>
                  <span>{decision.label}</span>
                  <h3>{decision.title}</h3>
                  <p>{decision.reason}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="design-section section-pad" id="design" aria-labelledby="design-title">
          <div className="page-shell">
            <div className="section-index">04 / 体验设计</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">DESIGN THE ENERGY, NOT ONLY THE SLIDES</p>
                <h2 id="design-title" className="section-title">
                  工具是内容，注意力、情绪和行动才是体验。
                </h2>
              </div>
              <p className="prose-large">
                三个半小时里，学员不可能一直保持同一种注意力。课程因此不靠持续刺激，而是有意识地在观看、理解、跟做、讨论和表达之间切换。
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
                      <figcaption>《老赵的一天》不是技术演示，而是场景入口。</figcaption>
                    </figure>
                  )}
                  {index === 1 && (
                    <div className="teacher-voices" aria-label="三位一线老师的内容分工">
                      <span>内部工具</span>
                      <span>文字场景</span>
                      <span>数据处理</span>
                      <p>真实做过的人，进入真实课程。</p>
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
                      <figcaption>后半程从“继续听”切换到“自己做”。</figcaption>
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
                <p className="eyebrow">A SMALL BUT COMPLETE SYSTEM</p>
                <h3>AI 生成的不只是课件，也包括课堂里的小道具。</h3>
                <p>
                  学员共同写提示词生成中场音乐；同一首歌在结尾“音乐传物”中再次出现。加分卡与奖状由 AI 辅助设计，顶部小玩具另行购买。
                </p>
                <p className="evidence-note">这些细节负责恢复精力和建立记忆，但从不抢走学习主线。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="releases-section section-pad page-shell" id="releases" aria-labelledby="releases-title">
          <div className="section-index">05 / 四次上线</div>
          <div className="editorial-grid">
            <div>
              <p className="eyebrow">SHIP, OBSERVE, CHANGE</p>
              <h2 id="releases-title" className="section-title">
                同一门课，不是重复四次，而是连续上线四个版本。
              </h2>
            </div>
            <p className="prose-large">
              城市、人数和现场状态都不同。每一场都留下一个观察，再变成下一场能执行的修改：时间、语言、反馈机制、内容新鲜度与讲授状态。
            </p>
          </div>
          <CityReleaseLog />
        </section>

        <section className="reflection-section section-pad" id="reflection" aria-labelledby="reflection-title">
          <div className="page-shell">
            <div className="section-index">06 / 证据与反思</div>
            <div className="editorial-grid">
              <div>
                <p className="eyebrow">OUTCOMES WITHOUT OVERCLAIMING</p>
                <h2 id="reflection-title" className="section-title">
                  做得不错，不代表已经做好。
                </h2>
              </div>
              <div className="prose-large">
                <p>
                  这个项目没有足够证据证明长期效率提升，所以我不把热烈现场写成行为改变。更可信的结果，是具体观察、可复用资产和下一轮明确的问题。
                </p>
              </div>
            </div>

            <div className="outcome-grid">
              <article className="outcome-card outcome-card--quote">
                <span>课堂观察 · 匿名</span>
                <blockquote>“我刚才下载试了一下，真被震到了。”</blockquote>
                <p>山西场，一位学员在介绍语音输入后现场下载并体验。</p>
              </article>
              <figure className="outcome-card outcome-card--image">
                <Image
                  src="/projects/project-000/course/feedback-cards-anonymized.jpg"
                  alt="经过整体虚化处理的山西站感言卡合照"
                  fill
                  sizes="(max-width: 760px) 100vw, 42vw"
                />
                <figcaption>感言卡从第三场加入；公开版本整体虚化，不转写难以核验的字迹。</figcaption>
              </figure>
              <article className="outcome-card outcome-card--assets">
                <span>留下的可复用资产</span>
                <ul>
                  {reusableAssets.map((asset) => <li key={asset}>{asset}</li>)}
                </ul>
              </article>
            </div>

            <div className="product-loop">
              <div>
                <p className="eyebrow">TRAINING AS A RESEARCH SITE</p>
                <h3>课堂也暴露了内部 AI 产品真正需要继续解决的问题。</h3>
              </div>
              <ul>
                <li>信息是否足够新鲜</li>
                <li>回答能否围绕上下文继续追问</li>
                <li>关键信息是否完整</li>
                <li>一次对话能否在下次继续</li>
              </ul>
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
