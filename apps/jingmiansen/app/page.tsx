import type { Metadata } from "next";
import Image from "next/image";
import { SiteMark } from "@/components/brand/SiteMark";
import { EntranceDialogue } from "@/components/works/jingmiansen/CharacterDialogue";
import { JingmiansenWorks } from "@/components/works/jingmiansen/JingmiansenWorks";
import { lingmianChat } from "@/content/projects/jingmiansen-dialogues";
import styles from "@/styles/projects/jingmiansen.module.css";

export const metadata: Metadata = {
  title: { absolute: "静眠森" },
  description:
    "由灵眠在森林与梦境的边界引路，通向星月、雨夜与魔女列车中的小说、设定和幻想故事。",
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

        <div className={styles.entranceContent}>
          <SiteMark className={styles.entranceMark} tone="light" />
          <p className={styles.entranceEyebrow}>梦醒之前，故事在此停留</p>
          <h1 id="entrance-title">静眠森</h1>

          <EntranceDialogue character={lingmianChat} />
        </div>
      </section>

      <JingmiansenWorks />

      <footer className={styles.entranceFooter}>
        <Image
          className={styles.entranceBrand}
          src="/projects/jingmiansen/brand/jingmiansen-lockup-light.png"
          alt="静眠森 JINGMIANSEN"
          width={102}
          height={123}
        />
      </footer>
    </div>
  );
}
