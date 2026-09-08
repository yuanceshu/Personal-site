export type JingmiansenCharacterId = "lingmian" | "felica" | "marina";

export type CharacterChatConfig = {
  characterId: JingmiansenCharacterId;
  name: string;
  role: string;
  introduction: string;
  starters: readonly [string, string, string];
  scene: {
    src: string;
    position: string;
  };
  portrait: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
};

export const lingmianChat = {
  characterId: "lingmian",
  name: "灵眠",
  role: "静眠森的守望者与引路者",
  introduction:
    "我在。你不必先记住这里所有的名字，想知道什么，就从眼前最在意的那件事开始吧。",
  starters: [
    "第一次来到静眠森，我该从哪里开始？",
    "你平时怎样分辨梦与现实的边界？",
    "如果我只是想安静待一会儿，也可以吗？",
  ],
  scene: {
    src: "/projects/jingmiansen/forest-entrance.avif",
    position: "58% 50%",
  },
  portrait: {
    src: "/projects/jingmiansen/characters/lingmian-v2.webp",
    alt: "灰白短发、蓝灰眼睛，肩侧伴有猫灵的灵眠",
    width: 1024,
    height: 1536,
  },
} as const satisfies CharacterChatConfig;

export const felicaChat = {
  characterId: "felica",
  name: "菲莉卡",
  role: "来自迷雾之森的列车旅人",
  introduction:
    "列车还没有发车，能说一会儿话。想聊森林、猫灵，或是眼前这段旅途，都可以直接告诉我。",
  starters: [
    "你还记得迷雾之森吗？",
    "猫灵是怎样的一群伙伴？",
    "这列车会经过怎样的地方？",
  ],
  scene: {
    src: "/projects/jingmiansen/scenes/witch-train.avif",
    position: "68% 50%",
  },
  portrait: {
    src: "/projects/jingmiansen/characters/felica.webp",
    alt: "金色双辫、绿色眼睛的菲莉卡",
    width: 900,
    height: 1091,
  },
} as const satisfies CharacterChatConfig;

export const marinaChat = {
  characterId: "marina",
  name: "真理奈",
  role: "雨夜啡庭的咖啡师与星辉魔女",
  introduction:
    "雨还没有停。你可以在这里歇一会儿，聊咖啡、星光，或只是说说此刻的心情。",
  starters: [
    "今夜适合喝什么样的咖啡？",
    "雨夜啡庭平时是什么样的？",
    "你愿意和我说说星辉魔法吗？",
  ],
  scene: {
    src: "/projects/jingmiansen/scenes/rainy-night-cafe.avif",
    position: "66% 50%",
  },
  portrait: {
    src: "/projects/jingmiansen/characters/marina.webp",
    alt: "银白长发、蓝色眼睛的真理奈",
    width: 1023,
    height: 1537,
  },
} as const satisfies CharacterChatConfig;

export const workChatByHref: Readonly<Record<string, CharacterChatConfig>> = {
  "/witch-train": felicaChat,
  "/rainy-night-cafe": marinaChat,
};
