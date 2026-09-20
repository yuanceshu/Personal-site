export type Thought = {
  title: string;
  date: string; // ISO: "2026-06-14"
  url: string; // 公众号原文链接
  excerpt: string;
  theme: string;
};

export const publicAccountName = "小袁AI感雾";

export const thoughts: readonly Thought[] = [
  {
    title: "个人 AI 复盘：过去如何学？现在如何用？未来走向哪？（上·理论学习篇）",
    date: "2026-06-14",
    url: "https://mp.weixin.qq.com/s/iANWc38L5VjHKYtrN7o-aQ",
    excerpt:
      "从贴着外墙打转，到摸到属于自己的那条路。记下播客、公众号，和那些让我重新爱上这个世界的人。",
    theme: "学习复盘",
  },
  {
    title: "效率越高，人越累？从水稻到 AI，我们一直没逃掉的陷阱",
    date: "2026-04-16",
    url: "https://mp.weixin.qq.com/s/hN2eGDV0E8k2CtlewIW7kA",
    excerpt:
      "从水稻到 AI，系统越来越高效，个体越来越疲惫。如果效率只是为了让系统吞噬个体，「轻松」就是幻觉。",
    theme: "效率反思",
  },
  {
    title: "AI FUTURE 散场：被「永远好奇」的气流包裹，我只想奋力追赶",
    date: "2026-04-09",
    url: "https://mp.weixin.qq.com/s/-UPCKP0xXqy-JVY4qQ5_pA",
    excerpt:
      "离前沿很近，离差距也很近。散场时被「永远好奇」的气流包裹着，只想奋力追赶。",
    theme: "展会随笔",
  },
];
