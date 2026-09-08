import storyText from "./jingmiansen-xingyue-text.json";

export type StoryVisual = {
  sourceAsset: string;
  desktop: {
    avif: string;
    webp: string;
    width: number;
    height: number;
  };
  mobile: {
    avif: string;
    webp: string;
    width: number;
    height: number;
  };
  desktopFocus: string;
  mobileFocus: string;
  alt: string;
};

export type StoryBeat = {
  id: string;
  paragraphStart: number;
  paragraphEnd: number;
  sceneBreakBefore?: "breath";
  mode:
    | "sticky"
    | "prose"
    | "visual-pair"
    | "dual-memory"
    | "convergence";
  visualLayout?: "bleed" | "split" | "panorama" | "dual";
  textPosition: "left" | "right" | "center";
  tone: "silver" | "gold" | "violet" | "warm";
  visual?: StoryVisual;
  secondaryVisual?: StoryVisual;
};

export type StoryChapter = {
  id: string;
  title: string;
  subtitle: string;
  paragraphs: readonly string[];
  beats: readonly StoryBeat[];
};

const assetRoot =
  "/projects/jingmiansen/stories/xing-yue-xiang-hu";

function makeVisual(
  slug: string,
  sourceAsset: string,
  desktop: [number, number],
  mobile: [number, number],
  desktopFocus = "50% 50%",
  mobileFocus = desktopFocus,
  alt = "",
): StoryVisual {
  return {
    sourceAsset,
    desktop: {
      avif: `${assetRoot}/${slug}-desktop.avif`,
      webp: `${assetRoot}/${slug}-desktop.webp`,
      width: desktop[0],
      height: desktop[1],
    },
    mobile: {
      avif: `${assetRoot}/${slug}-mobile.avif`,
      webp: `${assetRoot}/${slug}-mobile.webp`,
      width: mobile[0],
      height: mobile[1],
    },
    desktopFocus,
    mobileFocus,
    alt,
  };
}

export const storyHeroVisual = makeVisual(
  "prologue",
  "IMG-SCENE-001-雨夜咖啡店外景-候选1.png",
  [1536, 1024],
  [960, 640],
  "50% 58%",
  "58% 50%",
  "雨夜石巷尽头，咖啡店的木门与窗格透出温暖灯光",
);

export const storyVisuals = {
  "ch1-01": makeVisual("ch1-01", "IMG-PAGE-001-童年书桌与高耸魔法典籍-v2.png", [1536, 1024], [640, 960], "62% 50%", "50% 48%"),
  "ch1-02": makeVisual("ch1-02", "IMG-PAGE-002-少女真理奈聚光施法-v2.png", [1024, 1536], [640, 960], "50% 38%", "50% 38%"),
  "ch1-03": makeVisual("ch1-03", "IMG-PAGE-003-皇家庆典法阵启动-v2.png", [1536, 1024], [960, 640], "50% 52%", "50% 50%"),
  "ch1-04": makeVisual("ch1-04", "IMG-PAGE-004-失控流星与观礼台惊乱-v2.png", [1536, 1024], [960, 640], "50% 50%", "48% 50%"),
  "ch1-05": makeVisual("ch1-05", "IMG-PAGE-005-荆棘项圈扣颈瞬间-v3.png", [1024, 1536], [640, 960], "50% 36%", "50% 34%"),
  "ch1-06": makeVisual("ch1-06", "IMG-PAGE-006-监狱黑暗中星辉熄灭-v2.png", [1024, 1536], [640, 960], "50% 42%", "50% 40%"),
  "ch1-07": makeVisual("ch1-07", "IMG-PAGE-008-白银乡雨巷与祈福集市喧闹远景-v2.png", [1600, 640], [960, 384], "50% 50%", "50% 50%"),
  "ch1-08": makeVisual("ch1-08", "IMG-PAGE-009-真理奈在喧闹中抱头蹲下-v2.png", [1024, 1536], [640, 960], "50% 42%", "50% 38%"),
  "ch1-09": makeVisual("ch1-09", "IMG-PAGE-011-慌乱压制与旧疤幻痛发作-v5.png", [1600, 688], [960, 413], "48% 50%", "48% 50%"),
  "ch1-10": makeVisual("ch1-10", "IMG-PAGE-014-温软以太裹住失控星辉-v2.png", [1600, 640], [960, 384], "50% 50%", "50% 50%"),
  "ch1-11": makeVisual("ch1-11", "IMG-PAGE-017-星辉贴门化作淡银纹-v2.png", [1600, 640], [960, 384], "50% 50%", "54% 50%"),
  "ch1-12": makeVisual("ch1-12", "IMG-PAGE-018-真理奈停在门前被暖光包围-v2.png", [1024, 1536], [640, 960], "50% 42%", "50% 38%"),
  "ch1-13": makeVisual("ch1-13", "IMG-PAGE-019-雨夜店内暖光与沉静日常-v2.png", [1600, 900], [960, 540], "50% 50%", "50% 50%"),
  "ch1-14": makeVisual("ch1-14", "IMG-PAGE-023-真理奈转身想逃却被门扉温柔托住-v3.png", [1024, 1536], [640, 960], "50% 42%", "50% 38%"),
  "ch1-15": makeVisual("ch1-15", "IMG-PAGE-025-真理奈在角落安静磨豆-v3.png", [1600, 900], [960, 540], "50% 50%", "55% 50%"),
  "ch1-16": makeVisual("ch1-16", "IMG-PAGE-012-星辉飘向灯笼的危机-v3.png", [1600, 640], [960, 384]),
  "ch1-17": makeVisual("ch1-17", "IMG-PAGE-020-真理奈察觉结界细小缺口-v2.png", [1024, 1536], [640, 960], "50% 42%", "50% 38%"),
  "ch1-18": makeVisual("ch1-18", "IMG-PAGE-021-星辉落入木纹与旅人身旁-v3.png", [1024, 1536], [640, 960], "50% 42%", "50% 38%"),
  "ch1-19": makeVisual("ch1-19", "IMG-PAGE-022-林恩递来甜咖啡-v2.png", [1600, 900], [960, 540]),
  "ch1-20": makeVisual("ch1-20", "PANEL-R1-P01-03-缺少外泄光丝-v01.png", [1536, 1024], [960, 640], "50% 50%", "50% 50%"),
  "ch1-21": makeVisual("ch1-21", "PANEL-R1-P01-01-v01.png", [1600, 640], [960, 384], "50% 50%", "50% 50%"),
  "ch2-01": makeVisual("ch2-01", "IMG-SCENE-002-里茶庭-候选1.png", [1536, 1024], [960, 640], "50% 50%", "50% 50%"),
  "ch2-02": makeVisual("ch2-02", "IMG-PAGE-031-希斯达娅抱着香草包推门而入.png", [1024, 1536], [640, 960], "50% 40%", "50% 38%"),
  "ch2-03": makeVisual("ch2-03", "IMG-PAGE-032-希斯达娅看见真理奈后整个人愣住-v3.png", [1024, 1536], [640, 960], "50% 40%", "50% 38%"),
  "ch2-04": makeVisual("ch2-04", "IMG-PAGE-034-真理奈抬头与希斯达娅对视-v3.png", [1600, 900], [960, 540], "50% 50%", "52% 50%"),
  "ch2-05": makeVisual("ch2-05", "IMG-PAGE-036-希斯达娅轻声喊出学姐-v4.png", [1024, 1536], [640, 960], "50% 40%", "50% 38%"),
  "ch2-06": makeVisual("ch2-06", "PANEL-R1-P11-02-v01.png", [1024, 1536], [640, 960], "50% 40%", "50% 38%"),
  "ch2-07": makeVisual("ch2-07", "PANEL-R1-P13-04-v02.png", [1600, 726], [960, 436], "50% 50%", "50% 50%"),
  "ch2-08": makeVisual("ch2-08", "PANEL-R1-P14-05-v01.png", [1600, 691], [960, 415], "50% 50%", "50% 50%"),
  "ch2-09": makeVisual("ch2-09", "IMG-PAGE-035-两人一起收拢星尾草-v4.png", [1024, 1536], [640, 960], "50% 40%", "50% 38%"),
  "ch2-10": makeVisual("ch2-10", "GEN-SCENE-011-希斯达娅挡在真理奈身前-v1.png", [1536, 1024], [960, 640], "50% 50%", "50% 50%"),
  "ch2-11": makeVisual("ch2-11", "IMG-PAGE-026-擦桌收盘与整理书页-v2.png", [1024, 1536], [640, 960], "50% 42%", "50% 40%"),
  "ch2-12": makeVisual("ch2-12", "GEN-SCENE-012-真理奈与希斯达娅调制白银之露-v1.png", [1536, 1024], [960, 640], "50% 50%", "50% 50%"),
  "ch3-01": makeVisual("ch3-01", "IMG-SCENE-003-香草温室-候选1.png", [1536, 1024], [960, 640], "50% 50%", "50% 50%"),
  "ch3-02": makeVisual("ch3-02", "GEN-SCENE-004-希斯达娅童年香草庭院-v1.png", [1600, 900], [960, 540], "62% 50%", "66% 50%"),
  "ch3-03": makeVisual("ch3-03", "GEN-SCENE-005-善意受骗后的村落余波-v1.png", [1600, 900], [960, 540], "36% 50%", "33% 50%"),
  "ch3-04": makeVisual("ch3-04", "GEN-SCENE-006-清辉石前的夜间修行-v1.png", [1600, 900], [960, 540], "67% 50%", "68% 50%"),
  "ch3-05": makeVisual("ch3-05", "GEN-SCENE-007-真理奈与希斯达娅雨夜窗边-v1.png", [1600, 900], [960, 540], "68% 50%", "70% 50%"),
  "ch3-06": makeVisual("ch3-06", "GEN-SCENE-008-希斯达娅在影缚遗迹获得黑暗力量-v1.png", [1600, 900], [960, 540], "68% 50%", "70% 50%"),
  "ch3-07": makeVisual("ch3-07", "GEN-SCENE-009-希斯达娅误伤妹妹后的惊醒-v1.png", [1600, 900], [960, 540], "62% 50%", "60% 50%"),
  "ch3-08": makeVisual("ch3-08", "GEN-SCENE-010-真理奈与希斯达娅共同整理香草-v1.png", [1600, 900], [960, 540], "66% 50%", "68% 50%"),
} as const;

const chapterBeatSets: readonly (readonly StoryBeat[])[] = [
  [
    { id: "c1-01", paragraphStart: 0, paragraphEnd: 2, mode: "sticky", visualLayout: "bleed", textPosition: "left", tone: "silver", visual: storyVisuals["ch1-01"] },
    { id: "c1-02", paragraphStart: 2, paragraphEnd: 3, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "silver", visual: storyVisuals["ch1-02"] },
    { id: "c1-03", paragraphStart: 3, paragraphEnd: 4, mode: "visual-pair", visualLayout: "dual", textPosition: "center", tone: "violet", visual: storyVisuals["ch1-03"], secondaryVisual: storyVisuals["ch1-04"] },
    { id: "c1-04", paragraphStart: 4, paragraphEnd: 5, mode: "visual-pair", visualLayout: "dual", textPosition: "center", tone: "violet", visual: storyVisuals["ch1-05"], secondaryVisual: storyVisuals["ch1-06"] },
    { id: "c1-05", paragraphStart: 5, paragraphEnd: 6, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "violet", visual: storyVisuals["ch1-20"] },
    { id: "c1-06a", paragraphStart: 6, paragraphEnd: 8, mode: "prose", textPosition: "center", tone: "silver" },
    { id: "c1-06b", paragraphStart: 8, paragraphEnd: 10, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "silver", visual: storyVisuals["ch1-21"] },
    { id: "c1-07", paragraphStart: 10, paragraphEnd: 11, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "silver", visual: storyVisuals["ch1-07"] },
    { id: "c1-08", paragraphStart: 11, paragraphEnd: 12, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "violet", visual: storyVisuals["ch1-08"] },
    { id: "c1-09", paragraphStart: 12, paragraphEnd: 13, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "violet", visual: storyVisuals["ch1-09"] },
    { id: "c1-10", paragraphStart: 13, paragraphEnd: 15, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "violet", visual: storyVisuals["ch1-16"] },
    { id: "c1-11", paragraphStart: 15, paragraphEnd: 16, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "silver", visual: storyVisuals["ch1-10"] },
    { id: "c1-12", paragraphStart: 16, paragraphEnd: 17, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "silver", visual: storyVisuals["ch1-11"] },
    { id: "c1-13", paragraphStart: 17, paragraphEnd: 18, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "warm", visual: storyVisuals["ch1-12"] },
    { id: "c1-14", paragraphStart: 18, paragraphEnd: 21, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "warm", visual: storyVisuals["ch1-13"] },
    { id: "c1-15", paragraphStart: 21, paragraphEnd: 24, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "silver", visual: storyVisuals["ch1-17"] },
    { id: "c1-16", paragraphStart: 24, paragraphEnd: 27, mode: "sticky", visualLayout: "split", textPosition: "left", tone: "silver", visual: storyVisuals["ch1-18"] },
    { id: "c1-17", paragraphStart: 27, paragraphEnd: 29, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "warm", visual: storyVisuals["ch1-14"] },
    { id: "c1-18", paragraphStart: 29, paragraphEnd: 32, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "warm", visual: storyVisuals["ch1-19"] },
    { id: "c1-19", paragraphStart: 32, paragraphEnd: 34, mode: "sticky", visualLayout: "bleed", textPosition: "left", tone: "warm", visual: storyVisuals["ch1-13"] },
    { id: "c1-20", paragraphStart: 34, paragraphEnd: 38, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "silver", visual: storyVisuals["ch1-15"] },
  ],
  [
    { id: "c2-01", paragraphStart: 0, paragraphEnd: 4, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "silver", visual: storyVisuals["ch2-01"] },
    { id: "c2-02", paragraphStart: 4, paragraphEnd: 6, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "silver", visual: storyVisuals["ch2-02"] },
    { id: "c2-03", paragraphStart: 6, paragraphEnd: 8, mode: "sticky", visualLayout: "split", textPosition: "left", tone: "silver", visual: storyVisuals["ch2-03"] },
    { id: "c2-04", paragraphStart: 8, paragraphEnd: 10, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "silver", visual: storyVisuals["ch2-04"] },
    { id: "c2-05a", paragraphStart: 10, paragraphEnd: 12, mode: "prose", textPosition: "center", tone: "silver" },
    { id: "c2-05b", paragraphStart: 12, paragraphEnd: 16, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "gold", visual: storyVisuals["ch2-10"] },
    { id: "c2-06", paragraphStart: 16, paragraphEnd: 20, mode: "sticky", visualLayout: "split", textPosition: "right", tone: "gold", visual: storyVisuals["ch2-05"] },
    { id: "c2-07", paragraphStart: 20, paragraphEnd: 24, mode: "sticky", visualLayout: "split", textPosition: "left", tone: "gold", visual: storyVisuals["ch2-09"] },
    { id: "c2-08", paragraphStart: 24, paragraphEnd: 28, mode: "prose", textPosition: "center", tone: "silver" },
    { id: "c2-09", paragraphStart: 28, paragraphEnd: 32, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "split", textPosition: "left", tone: "violet", visual: storyVisuals["ch2-06"] },
    { id: "c2-10", paragraphStart: 32, paragraphEnd: 36, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "violet", visual: storyVisuals["ch2-08"] },
    { id: "c2-11", paragraphStart: 36, paragraphEnd: 40, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "violet", visual: storyVisuals["ch2-07"] },
    { id: "c2-12", paragraphStart: 40, paragraphEnd: 44, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "split", textPosition: "right", tone: "silver", visual: storyVisuals["ch2-11"] },
    { id: "c2-13", paragraphStart: 44, paragraphEnd: 48, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "warm", visual: storyVisuals["ch2-12"] },
    { id: "c2-14", paragraphStart: 48, paragraphEnd: 50, mode: "prose", textPosition: "center", tone: "silver" },
  ],
  [
    { id: "c3-01", paragraphStart: 0, paragraphEnd: 4, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "gold", visual: storyVisuals["ch3-01"] },
    { id: "c3-02", paragraphStart: 4, paragraphEnd: 6, mode: "prose", textPosition: "center", tone: "gold" },
    { id: "c3-03", paragraphStart: 6, paragraphEnd: 9, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "gold", visual: storyVisuals["ch3-02"] },
    { id: "c3-04", paragraphStart: 9, paragraphEnd: 12, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "violet", visual: storyVisuals["ch3-03"] },
    { id: "c3-05", paragraphStart: 12, paragraphEnd: 16, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "violet", visual: storyVisuals["ch3-06"] },
    { id: "c3-06", paragraphStart: 16, paragraphEnd: 20, mode: "sticky", visualLayout: "panorama", textPosition: "right", tone: "violet", visual: storyVisuals["ch3-07"] },
    { id: "c3-07", paragraphStart: 20, paragraphEnd: 24, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "gold", visual: storyVisuals["ch3-04"] },
    { id: "c3-08", paragraphStart: 24, paragraphEnd: 28, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "split", textPosition: "right", tone: "gold", visual: storyVisuals["ch2-02"] },
    { id: "c3-09", paragraphStart: 28, paragraphEnd: 32, mode: "dual-memory", visualLayout: "dual", textPosition: "right", tone: "gold", visual: storyVisuals["ch2-04"], secondaryVisual: storyVisuals["ch2-05"] },
    { id: "c3-10", paragraphStart: 32, paragraphEnd: 36, mode: "convergence", visualLayout: "panorama", textPosition: "center", tone: "warm", visual: storyVisuals["ch2-07"] },
    { id: "c3-11", paragraphStart: 36, paragraphEnd: 40, sceneBreakBefore: "breath", mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "gold", visual: storyVisuals["ch3-08"] },
    { id: "c3-12", paragraphStart: 40, paragraphEnd: 44, mode: "sticky", visualLayout: "panorama", textPosition: "left", tone: "warm", visual: storyVisuals["ch3-05"] },
    { id: "c3-13", paragraphStart: 44, paragraphEnd: 45, mode: "prose", textPosition: "center", tone: "warm" },
  ],
];

export const xingyueStory: {
  title: string;
  readingTime: string;
  chapters: readonly StoryChapter[];
} = {
  title: storyText.title,
  readingTime: "约 35 分钟",
  chapters: storyText.chapters.map((chapter, index) => ({
    ...chapter,
    beats: chapterBeatSets[index],
  })),
};

const expectedParagraphCounts = [38, 50, 45];

xingyueStory.chapters.forEach((chapter, chapterIndex) => {
  if (chapter.paragraphs.length !== expectedParagraphCounts[chapterIndex]) {
    throw new Error(
      `星月相护「${chapter.title}」段落数异常：${chapter.paragraphs.length}`,
    );
  }

  let cursor = 0;
  chapter.beats.forEach((beat) => {
    if (
      beat.paragraphStart !== cursor ||
      beat.paragraphEnd <= beat.paragraphStart
    ) {
      throw new Error(`星月相护「${chapter.title}」场景范围不连续：${beat.id}`);
    }
    const paragraphCount = beat.paragraphEnd - beat.paragraphStart;
    if (beat.visual && (paragraphCount < 1 || paragraphCount > 4)) {
      throw new Error(`星月相护「${chapter.title}」画面承载段落数异常：${beat.id}`);
    }
    if (beat.mode === "visual-pair" && !beat.secondaryVisual) {
      throw new Error(`星月相护「${chapter.title}」双画面缺少第二幅素材：${beat.id}`);
    }
    if (beat.visual && !beat.visualLayout) {
      throw new Error(`星月相护「${chapter.title}」画面缺少展示布局：${beat.id}`);
    }
    if (!beat.visual && beat.visualLayout) {
      throw new Error(`星月相护「${chapter.title}」纯文字段落不应声明画面布局：${beat.id}`);
    }
    cursor = beat.paragraphEnd;
  });

  if (cursor !== chapter.paragraphs.length) {
    throw new Error(`星月相护「${chapter.title}」没有完整覆盖正文`);
  }
});
