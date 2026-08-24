import type { Metadata } from "next";
import Link from "next/link";
import { jingmiansenWorks } from "@/content/projects/jingmiansen";
import styles from "@/styles/projects/jingmiansen.module.css";

export const metadata: Metadata = {
  title: "静眠森",
  description:
    "由灵眠在森林与梦境的边界引路，通向角色、列车与雨夜里的小说、设定和幻想故事。",
};

export default function JingmiansenPage() {
  return (
    <div className={styles.entrancePage}>
      <a className={styles.skipLink} href="#open-works">
        跳到作品入口
      </a>

      <section className={styles.entranceHero} aria-labelledby="entrance-title">
        <picture className={styles.entranceScene}>
          <source
            srcSet="/projects/jingmiansen/forest-entrance.avif"
            type="image/avif"
          />
          <img
            src="/projects/jingmiansen/forest-entrance.webp"
            alt="幽蓝森林深处透出晨光，灵眠与猫灵站在水边"
          />
        </picture>
        <div className={styles.entranceReadability} aria-hidden="true" />

        <header className={styles.entranceHeader}>
          <Link className={styles.glassLink} href="/">
            <span aria-hidden="true">←</span>
            返回主站
          </Link>
        </header>

        <div className={styles.entranceContent}>
          <p className={styles.entranceEyebrow}>梦醒之前，故事在此停留</p>
          <h1 id="entrance-title">静眠森</h1>

          <div className={styles.greeting} aria-label="灵眠的迎接">
            <p>你好，这里是静眠森。</p>
            <p>
              我是灵眠。平时守着这片林，也替偶尔来到这里的人认一认路。
            </p>
            <p>
              这里有几条入口，通往不同的故事——有些来自梦境，有些，也未必分得清究竟是梦还是现实。
            </p>
            <p>如果你有兴趣，就去看看吧。</p>
          </div>

          <a className={styles.primaryAction} href="#open-works">
            进入森林
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <main className={styles.worksSection} id="open-works">
        <header className={styles.worksHeading}>
          <div>
            <p>已开放的故事</p>
            <h2>从一处入口开始</h2>
          </div>
          <p>
            它们彼此相连，却各自拥有自己的边界。你不需要先了解完整设定。
          </p>
        </header>

        <nav className={styles.workList} aria-label="静眠森作品">
          {jingmiansenWorks.map((work) => (
            <Link href={work.href} key={work.href}>
              <span className={styles.workIndex}>{work.index}</span>
              <span className={styles.workCopy}>
                <span>{work.category}</span>
                <strong>{work.title}</strong>
                <span>{work.description}</span>
              </span>
              <span className={styles.workCue}>{work.cue}</span>
              <span className={styles.workArrow} aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </nav>
      </main>

      <footer className={styles.entranceFooter}>
        <span>静眠森</span>
        <Link href="/">返回袁策书的个人作品站</Link>
      </footer>
    </div>
  );
}
