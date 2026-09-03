import type { Metadata } from "next";
import Link from "next/link";
import { EntranceDialogue } from "@/components/works/jingmiansen/CharacterDialogue";
import { JingmiansenWorks } from "@/components/works/jingmiansen/JingmiansenWorks";
import {
  felicaDialogue,
  lingmianDialogue,
} from "@/content/projects/jingmiansen-dialogues";
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

          <EntranceDialogue script={lingmianDialogue} />
        </div>
      </section>

      <JingmiansenWorks dialogue={felicaDialogue} />

      <footer className={styles.entranceFooter}>
        <span>静眠森</span>
        <Link href="/">返回个人作品站</Link>
      </footer>
    </div>
  );
}
