export type JingmiansenCharacterId = "lingmian" | "felica";

export type DialogueNode = {
  id: string;
  prompt: string;
  answer: readonly string[];
  next?: readonly string[];
};

export type DialogueScript = {
  characterId: JingmiansenCharacterId;
  name: string;
  role: string;
  greeting: readonly string[];
  start: readonly string[];
  nodes: Readonly<Record<string, DialogueNode>>;
};

export const lingmianDialogue = {
  characterId: "lingmian",
  name: "灵眠",
  role: "静眠森的守望者与引路者",
  greeting: [
    "我在。你不必先记住这里所有的名字。",
    "想知道什么，就从眼前最在意的那一件开始吧。",
  ],
  start: ["where", "why_guard", "where_start", "dream"],
  nodes: {
    where: {
      id: "where",
      prompt: "这里是什么地方？",
      answer: [
        "这里是静眠森，也是袁策书个人作品站里的一处创作世界。森林、梦境、猫灵和一些彼此相连的故事，都在这里留下了位置。",
        "你可以把它当作一片真实的森林，也可以只把它当作通往这些作品的入口。两种理解都不妨碍你继续往前走。",
      ],
      next: ["forest_dream", "choose_for_me"],
    },
    forest_dream: {
      id: "forest_dream",
      prompt: "森林和梦有什么关系？",
      answer: [
        "这里的灵能很浓，现实与梦之间的边界也比别处薄。睡着的人未必会来到森林，走进森林的人也未必在做梦。",
        "我做的，只是分清那道边界什么时候可以打开，什么时候应该关上。",
      ],
    },
    choose_for_me: {
      id: "choose_for_me",
      prompt: "你会替我决定去哪吗？",
      answer: [
        "不会。我可以告诉你每一处入口大致通向什么，但选择应该留给你。",
        "引路和替别人做决定，是两件不同的事。后者通常会省下一点时间，也会拿走一些本该属于你的判断。",
      ],
    },
    why_guard: {
      id: "why_guard",
      prompt: "你为什么守着这片林？",
      answer: [
        "最开始，我只是生活在这里。后来学着听懂它，再后来，发现自己已经不能把某些事情当作与我无关。",
        "守护不是一个称号。更多时候，它只是知道哪里出了问题，然后去处理。做得久了，外面的人便慢慢有了‘静眠森’这个名字。",
      ],
      next: ["cost", "quiet"],
    },
    cost: {
      id: "cost",
      prompt: "守护也有代价吗？",
      answer: [
        "当然。你看得越远，需要承担的事情通常也越多。力量不会替人免除代价，只会让可选择的范围变大。",
        "不过，代价并不自动意味着不值得。先看清它，再决定是否愿意承担，这就足够了。",
      ],
    },
    quiet: {
      id: "quiet",
      prompt: "森林真的会安静下来吗？",
      answer: [
        "不会。动物灵、植物、残留的意识和梦一直都在发出声音。",
        "安静下来的，是我自己。我小时候不知道怎样关上感知，后来才学会什么时候应该听，什么时候可以休息。",
      ],
    },
    where_start: {
      id: "where_start",
      prompt: "我该从哪里开始？",
      answer: [
        "如果想先认识这片森林，可以看关于我的那一页；如果更喜欢旅途与角色，就去看看菲莉卡与魔女列车；如果想读一处能停下来的地方，雨夜啡庭会更合适。",
        "它们彼此有关，但没有规定好的阅读顺序。你不需要先补完设定。",
      ],
      next: ["about_felica", "about_cafe"],
    },
    about_felica: {
      id: "about_felica",
      prompt: "菲莉卡是什么样的人？",
      answer: [
        "她由猫灵养大，待人比我更直接，也更容易把情绪写在耳朵和尾巴上。她后来走了很远，才把‘菲莉卡’和‘灵萤’两个名字一起认作自己。",
        "我们只见过一面。那次相遇的经过，现在还没有被完整写下来。除此之外，我不应该替她多说。",
      ],
    },
    about_cafe: {
      id: "about_cafe",
      prompt: "雨夜啡庭适合什么时候去？",
      answer: [
        "在你不急着得到答案的时候。那里的故事更关心人为什么停下、为什么留下，以及一份善意怎样慢慢变成可以容纳别人的地方。",
        "外面一直下雨，不过那不是进入它的条件。",
      ],
    },
    dream: {
      id: "dream",
      prompt: "梦境对你意味着什么？",
      answer: [
        "小时候，它更像一扇无法关上的门。学会控制之后，它才逐渐变成可以工作的地方，也成了我最喜欢用来创造东西的空间。",
        "现实里的木头会断，房子需要地基。梦没有这些义务。正因为我知道现实有多重，才会珍惜偶尔放下这些规则的机会。",
      ],
      next: ["dream_truth", "dream_create"],
    },
    dream_truth: {
      id: "dream_truth",
      prompt: "梦会告诉人真相吗？",
      answer: [
        "有时候会。更多时候，它只是把记忆、情绪和身体的感觉重新排列。",
        "如果一个梦看起来像预兆，最好先排除更普通的原因。比如压力，或者睡前吃得太多。",
      ],
    },
    dream_create: {
      id: "dream_create",
      prompt: "你会在梦里造什么？",
      answer: [
        "走到尽头又回到入口的长廊，永远望向同一个夜晚的窗，或者外面很小、里面却装得下一座庭院的盒子。",
        "大多没有实际用途。正因为没有，我才愿意花时间把它们做得更好。",
      ],
    },
  },
} as const satisfies DialogueScript;

export const felicaDialogue = {
  characterId: "felica",
  name: "菲莉卡",
  role: "来自迷雾之森的列车旅人",
  greeting: [
    "你好呀。列车还没有发车，能说一会儿话。",
    "不过如果它突然响铃，我可能得先去看看是不是又有谁把魔宠弄丢了。",
  ],
  start: ["train", "names", "cat_spirits", "home"],
  nodes: {
    train: {
      id: "train",
      prompt: "魔女列车是什么？",
      answer: [
        "它是一列只在夜里停靠、也不肯把站名好好写进地图的火车。车厢会跟着记忆和愿望长成不同的样子，推开门以前，很难猜到里面是什么。",
        "它收留迷路的人，也藏着不少不愿意立刻告诉你的事。表面安安静静，不代表每一节车厢都安全。",
      ],
      next: ["train_life", "train_truth"],
    },
    train_life: {
      id: "train_life",
      prompt: "你平时在车上做什么？",
      answer: [
        "照看魔宠、帮人找东西，有时候也替吵架的人听一听对方真正想说什么。猫灵教过我，炸毛的时候先别急着扑出去。",
        "偶尔法术会让盆栽长得太快……那个不算工作，更像需要立刻处理的事故。",
      ],
    },
    train_truth: {
      id: "train_truth",
      prompt: "列车到底藏着什么？",
      answer: [
        "有些事情我还不能替它公开。就像看见蜂蜜时，也得先闻一闻甜味后面有没有藏着蜂刺。",
        "至少可以告诉你：这里的和气并不等于没有恶意，所以我学会了更认真地分辨人，也更清楚自己想守住什么。",
      ],
    },
    names: {
      id: "names",
      prompt: "你为什么有两个名字？",
      answer: [
        "‘菲莉卡’是母亲留给我的名字。‘灵萤’是猫灵们给我的，‘灵’来自我和它们的联系，‘萤’是指尖会亮起来的那一点光。",
        "以前我以为只能选一个，像两条路分开以后就不能回头。后来才明白，两个名字可以一起留下。它们都是真的我。",
      ],
      next: ["which_name", "firefly"],
    },
    which_name: {
      id: "which_name",
      prompt: "那我应该怎么称呼你？",
      answer: [
        "叫菲莉卡就好。猫灵们喊‘灵萤’的时候，我也会回头。",
        "名字不是一道考试题。只要你是在认真叫我，就不用担心答错。",
      ],
    },
    firefly: {
      id: "firefly",
      prompt: "你的萤火能做什么？",
      answer: [
        "能照亮一点路，安抚小动物，有时候也会跟着情绪变得不太听话。紧张时它像漏气的蒲公英，刚飘起来就散啦。",
        "后来我学会把它和猫灵的感应、人的情绪放在一起。光没有变得夸张，只是终于知道该往哪里亮。",
      ],
    },
    cat_spirits: {
      id: "cat_spirits",
      prompt: "猫灵是你的家人吗？",
      answer: [
        "是呀。它们不会讲人类那些绕来绕去的道理，却知道什么时候该蜷在你旁边，什么时候该叼着你的后领把你从危险里拖回来。",
        "我从它们那里学会看夜路、听情绪，也学会了暖阳和鱼干有时比想不明白的问题更真实。",
      ],
      next: ["talk_to_cats", "cat_habits"],
    },
    talk_to_cats: {
      id: "talk_to_cats",
      prompt: "你真的能和猫说话？",
      answer: [
        "更像是把情绪、画面和意思一起递过去。它们也会这样回答我。",
        "普通猫的话会更简单：饿了、困了、这里是我的、那块垫子也是我的。最后一条通常没有商量的余地。",
      ],
    },
    cat_habits: {
      id: "cat_habits",
      prompt: "你也有猫的习惯吗？",
      answer: [
        "紧张时尾巴会绷起来，放松时偶尔会呼噜。平衡感和夜视也比普通人好一点。",
        "不过我不会因为桌上有杯子，就一定要把它推下去。至少大多数时候不会。",
      ],
    },
    home: {
      id: "home",
      prompt: "你还在找回家的路吗？",
      answer: [
        "还在。每一站停下时，我都会看看风的味道、植物的样子，也会向占卜师和书灵打听。",
        "以前‘回家’像一根拉得很紧的线，稍微松开就觉得自己会弄丢什么。现在它更像口袋里的苔球——一直在，也允许我先走好眼前这一段。",
      ],
      next: ["next_stop", "found_here"],
    },
    next_stop: {
      id: "next_stop",
      prompt: "下一站会到森林吗？",
      answer: [
        "也许呀。等待会让心跳像啄木鸟敲空树干——咚、咚，有路吗，没有路吗？",
        "我不会把每一站都当成答案，但还是会认真下车看看。希望和判断可以一起带着，不冲突。",
      ],
    },
    found_here: {
      id: "found_here",
      prompt: "你在列车上找到过什么？",
      answer: [
        "同伴，新的力量，还有把两个名字放在一起的勇气。也学会了有些笑脸像甜浆果，里面却可能藏着发苦的种子。",
        "这些不能替代森林，不过它们让我回去的时候，不再只是那个被传送阵卷走的小女孩。",
      ],
    },
  },
} as const satisfies DialogueScript;
