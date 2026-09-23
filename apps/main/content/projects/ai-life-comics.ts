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
    kicker: "01 · 第一次试着画",
    title: "把洗鼻子，画成一场鼻腔小冒险",
    description: "最开始，小麦子怕水流进鼻子里。我们不急着劝她，而是给小水滴、云朵和小伙伴，铺了一条热热闹闹的小路。",
    note: "这是最早动笔的一篇，也是第一次发觉：原来想象真的能给生活换一扇门。",
    versions: [
      {
        id: "nose-magic",
        title: "香香小镇与魔法喷枪",
        caption: "让洗鼻子，变成一场新冒险的开头",
        image: "/projects/ai-life-comics/nose/nose-magic.webp",
        width: 2752,
        height: 1536,
        alt: "洗鼻子漫画版本：小麦子和白色小熊把洗鼻子想象成魔法喷枪冒险",
      },
      {
        id: "nose-adventure",
        title: "鼻子小冒险家",
        caption: "小水滴变成小船，鼻子里也有自己的目的地",
        image: "/projects/ai-life-comics/nose/nose-adventure.webp",
        width: 2048,
        height: 2048,
        alt: "洗鼻子漫画版本：小麦子和小伙伴乘船进入彩虹般的鼻子冒险",
      },
      {
        id: "nose-gentle",
        title: "小水滴的回家小路",
        caption: "轻轻冲一冲，就能顺顺利利回到家",
        image: "/projects/ai-life-comics/nose/nose-gentle.webp",
        width: 2752,
        height: 1536,
        alt: "洗鼻子漫画版本：小麦子和妈妈把水滴想象成回家的小队伍",
      },
    ],
  },
  {
    id: "away",
    kicker: "02 · 妈妈出差的日子",
    title: "妈妈出差了，爱会沿着小路回家",
    description: "要离开几天的妈妈，被画成一段有准备、有想念，也有明确终点的旅程。小兔子留在枕边，回家的小路也一直都在。",
    note: "不是把想念变轻，而是让“妈妈会回来”这件事，有了能反复看见的模样。",
    versions: [
      {
        id: "mom-away",
        title: "一条画出来的回家小路",
        caption: "想妈妈的时候，就沿着小路走一走",
        image: "/projects/ai-life-comics/away/mom-away.webp",
        width: 1327,
        height: 1186,
        alt: "妈妈出差漫画：妈妈和小麦子准备行李，并约定沿着小路回家",
      },
    ],
  },
  {
    id: "pee",
    kicker: "03 · 妈妈去一小会儿",
    title: "妈妈离开一小会儿，身体也要好好照料",
    description: "小麦子不喜欢妈妈去卫生间，我们把这件事画成「身体里小水滴的上班时间」：妈妈照顾好自己，很快就回来啦。",
    note: "这一组留了最多的版本。每一次重画，都是在找一个她更愿意相信、也更容易等下去的理由。",
    versions: [
      {
        id: "pee-station",
        title: "小水滴车站",
        caption: "妈妈去身体里的小水滴车站啦",
        image: "/projects/ai-life-comics/pee/pee-station.webp",
        width: 1672,
        height: 941,
        alt: "妈妈去尿尿漫画：小水滴们在身体里的车站工作，妈妈很快回家",
      },
      {
        id: "pee-body-station",
        title: "身体里的小水站",
        caption: "每个人呀，都有自己的小水站",
        image: "/projects/ai-life-comics/pee/pee-body-station.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：身体里的小水滴们守护妈妈的小水站",
      },
      {
        id: "pee-waiting-team",
        title: "等待小小队长",
        caption: "等妈妈回来，再接着搭积木",
        image: "/projects/ai-life-comics/pee/pee-waiting-team.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：小麦子成为等待妈妈回来的小队长",
      },
      {
        id: "pee-home-route",
        title: "小水滴的回家小路",
        caption: "妈妈去照顾身体，小水滴也在认真工作",
        image: "/projects/ai-life-comics/pee/pee-home-route.webp",
        width: 2752,
        height: 1536,
        alt: "妈妈去尿尿漫画版本：小水滴沿着回家路工作，妈妈照顾自己的身体",
      },
      {
        id: "pee-v2",
        title: "小水滴车站·第二版",
        caption: "把等待，画成一件能慢慢完成的小事",
        image: "/projects/ai-life-comics/pee/pee-v2.webp",
        width: 1536,
        height: 1024,
        alt: "妈妈去尿尿漫画版本：小麦子在门外等待妈妈回来，并继续搭积木",
      },
    ],
  },
  {
    id: "sleep",
    kicker: "04 · 妈妈累了要睡觉",
    title: "妈妈睡着了，陪伴也不会打烊",
    description: "妈妈太累要睡觉的时候，小麦子总担心没人陪自己玩。于是我们画了这样一个夜晚：妈妈先休息，爱和陪伴还安安静静待在房间里。",
    note: "有时候爱不是说很多话，而是在对方需要的时候，安安静静地陪着。",
    versions: [
      {
        id: "mom-sleep",
        title: "安安静静陪妈妈",
        caption: "先照顾好彼此，再走回温暖的房间",
        image: "/projects/ai-life-comics/sleep/mom-sleep.webp",
        width: 1216,
        height: 1294,
        alt: "妈妈睡觉漫画：小麦子理解妈妈需要休息，最后和妈妈温暖地拥抱",
      },
    ],
  },
  {
    id: "cat-mouse",
    kicker: "05 · 游戏里的输赢",
    title: "被抓住啦，也不算游戏落幕",
    description: "猫捉老鼠的游戏里，小麦子总怕自己被抓到。漫画把输赢还给游戏本身：被碰到了就歇一歇，下一轮还能重新出发。",
    note: "这一次不是让害怕消失，而是让规则变得软一点，给每个孩子重新加入的勇气。",
    versions: [
      {
        id: "cat-mouse",
        title: "秘密洞洞里的下一轮",
        caption: "换换角色，大家都能接着玩",
        image: "/projects/ai-life-comics/cat-mouse/cat-mouse.webp",
        width: 1254,
        height: 1254,
        alt: "猫抓老鼠游戏漫画：被猫碰到的小朋友在秘密洞洞休息，下一轮继续游戏",
      },
    ],
  },
  {
    id: "badminton",
    kicker: "06 · 把快乐存起来",
    title: "一起去打球吧，快乐会翻一倍",
    description: "羽毛球这一篇，不是为了解决什么害怕。那天大家玩得太开心，我们只是想把这份开心再画一遍，让记忆能多停留一会儿。",
    note: "生活不只有要去克服的事，也有值得好好藏起来的快乐。",
    versions: [
      {
        id: "badminton",
        title: "和爸爸妈妈一起去球馆",
        caption: "每一次挥拍，都是一起长大的印记",
        image: "/projects/ai-life-comics/badminton/badminton.webp",
        width: 1024,
        height: 1536,
        alt: "羽毛球漫画：小麦子和爸爸妈妈、朋友们一起在羽毛球馆玩耍",
      },
    ],
  },
] as const;

export const comicVersionCount = comicStories.reduce((total, story) => total + story.versions.length, 0);
