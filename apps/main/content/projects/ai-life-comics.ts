export type ComicVersion = {
  id: string;
  title: string;
  caption: string;
  image: string;
  width: number;
  height: number;
  alt: string;
};

export type ComicStory = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  note: string;
  versions: readonly ComicVersion[];
};

export const comicStories: readonly ComicStory[] = [
  {
    id: "nose",
    kicker: "01 · 第一次尝试",
    title: "把洗鼻子画成一场鼻子冒险",
    description: "最开始，小麦子害怕水进鼻子。我们先不急着说服她，而是给水滴、云朵和小伙伴安排了一条好玩的路。",
    note: "这是最早开始的一部，也是第一次发现：原来想象真的可以帮生活换一个入口。",
    versions: [
      {
        id: "nose-magic",
        title: "香香小镇与魔法喷枪",
        caption: "让洗鼻子成为解锁新冒险的起点",
        image: "/projects/ai-life-comics/nose/nose-magic.webp",
        width: 2752,
        height: 1536,
        alt: "洗鼻子漫画版本：小麦子和白色小熊把洗鼻子想象成魔法喷枪冒险",
      },
      {
        id: "nose-adventure",
        title: "鼻子冒险家",
        caption: "水滴变成小船，鼻子有自己的目的地",
        image: "/projects/ai-life-comics/nose/nose-adventure.webp",
        width: 2048,
        height: 2048,
        alt: "洗鼻子漫画版本：小麦子和小伙伴乘船进入彩虹般的鼻子冒险",
      },
      {
        id: "nose-gentle",
        title: "小水滴的回家路",
        caption: "轻轻冲一冲，就能顺利回到家",
        image: "/projects/ai-life-comics/nose/nose-gentle.webp",
        width: 2752,
        height: 1536,
        alt: "洗鼻子漫画版本：小麦子和妈妈把水滴想象成回家的小队伍",
      },
    ],
  },
  {
    id: "away",
    kicker: "02 · 妈妈出差",
    title: "妈妈出差，也会沿着小路回家",
    description: "离开几天的妈妈，被画成一段有准备、有想念、也有明确终点的旅程。小兔子留在身边，回家的小路也一直在。",
    note: "不是把想念变小，而是让“妈妈会回来”有一个可以反复看见的样子。",
    versions: [
      {
        id: "mom-away",
        title: "一条画出来的回家小路",
        caption: "想妈妈的时候，就沿着小路想一想",
        image: "/projects/ai-life-comics/away/mom-away.webp",
        width: 1327,
        height: 1186,
        alt: "妈妈出差漫画：妈妈和小麦子准备行李，并约定沿着小路回家",
      },
    ],
  },
  {
    id: "pee",
    kicker: "03 · 妈妈去尿尿",
    title: "妈妈离开一小会儿，身体也要被照顾",
    description: "小麦子不喜欢妈妈去卫生间，我们把这件事画成“身体小水滴的工作时间”：妈妈照顾好自己，很快就会回来。",
    note: "这一组留下了最多版本。每一次重画，都是在找一个她更愿意相信、更容易等一会儿的解释。",
    versions: [
      {
        id: "pee-station",
        title: "小水滴车站",
        caption: "妈妈去一趟身体里的小水滴车站",
        image: "/projects/ai-life-comics/pee/pee-station.webp",
        width: 1672,
        height: 941,
        alt: "妈妈去尿尿漫画：小水滴们在身体里的车站工作，妈妈很快回家",
      },
      {
        id: "pee-body-station",
        title: "身体的小水站",
        caption: "每个人都有自己的小水站",
        image: "/projects/ai-life-comics/pee/pee-body-station.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：身体里的小水滴们守护妈妈的小水站",
      },
      {
        id: "pee-waiting-team",
        title: "等待小队长",
        caption: "等妈妈回来，再继续玩积木",
        image: "/projects/ai-life-comics/pee/pee-waiting-team.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：小麦子成为等待妈妈回来的小队长",
      },
      {
        id: "pee-home-route",
        title: "小水滴的回家路",
        caption: "妈妈去照顾身体，小水滴也在工作",
        image: "/projects/ai-life-comics/pee/pee-home-route.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：小水滴沿着回家路工作，妈妈照顾自己的身体",
      },
      {
        id: "pee-v2",
        title: "小水滴车站 · V2",
        caption: "把等待画成一项可以完成的小任务",
        image: "/projects/ai-life-comics/pee/pee-v2.webp",
        width: 1536,
        height: 1024,
        alt: "妈妈去尿尿漫画版本：小麦子在门外等待妈妈回来，并继续搭积木",
      },
    ],
  },
  {
    id: "sleep",
    kicker: "04 · 妈妈睡觉",
    title: "妈妈睡着了，陪伴没有消失",
    description: "当妈妈太累需要睡觉，小麦子会担心没人陪她玩。于是我们画下一个晚上：妈妈先休息，爱和陪伴还在房间里。",
    note: "有时候，爱不是说很多话，而是在对方需要的时候，安静地陪着她。",
    versions: [
      {
        id: "mom-sleep",
        title: "安静陪妈妈",
        caption: "先照顾好彼此，再回到温暖的房间",
        image: "/projects/ai-life-comics/sleep/mom-sleep.webp",
        width: 1216,
        height: 1294,
        alt: "妈妈睡觉漫画：小麦子理解妈妈需要休息，最后和妈妈温暖地拥抱",
      },
    ],
  },
  {
    id: "cat-mouse",
    kicker: "05 · 游戏输赢",
    title: "被抓住，也不代表游戏结束",
    description: "猫抓老鼠游戏里，小麦子害怕自己被抓住。漫画把输赢放回游戏本身：被碰到可以休息，下一轮还可以重新出发。",
    note: "这一次不是让害怕消失，而是让规则变得更温柔，让每个孩子都有重新加入的机会。",
    versions: [
      {
        id: "cat-mouse",
        title: "秘密洞洞里的下一轮",
        caption: "换一换角色，大家都能继续玩",
        image: "/projects/ai-life-comics/cat-mouse/cat-mouse.webp",
        width: 1254,
        height: 1254,
        alt: "猫抓老鼠游戏漫画：被猫碰到的小朋友在秘密洞洞休息，下一轮继续游戏",
      },
    ],
  },
  {
    id: "badminton",
    kicker: "06 · 把快乐留下来",
    title: "一起去打球，快乐会加倍",
    description: "羽毛球漫画不负责解决一个害怕的问题。那天大家玩得很开心，我们只是想把这份开心再画一遍，让记忆有机会多停留一会儿。",
    note: "生活不只有需要克服的事，也有值得被认真保存的快乐。",
    versions: [
      {
        id: "badminton",
        title: "和爸爸妈妈一起去球馆",
        caption: "每一次挥拍，都是一起长大的记号",
        image: "/projects/ai-life-comics/badminton/badminton.webp",
        width: 1024,
        height: 1536,
        alt: "羽毛球漫画：小麦子和爸爸妈妈、朋友们一起在羽毛球馆玩耍",
      },
    ],
  },
] as const;

export const comicVersionCount = comicStories.reduce((total, story) => total + story.versions.length, 0);
