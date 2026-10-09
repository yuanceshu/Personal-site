import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { fixture, records } from "./helpers";

const resultSchema = z.object({ answers: z.array(z.object({ topic: z.string(), answer: z.string() })) });

test("模糊政策咨询列出完整编号目录，不执行业务操作", async () => {
  const f = await fixture();
  try {
    for (const question of ["问供暖政策", "我想了解一下规定", "有哪些可以问的政策？", "政策目录"]) {
      const { answers } = resultSchema.parse(await f.service.execute(f.session.actor, { name: "query_policy", input: { question } }));
      assert.equal(answers.length, 1);
      assert.equal(answers[0].topic, "政策咨询目录");
      assert.match(answers[0].answer, /1\. 供暖时间/);
      assert.match(answers[0].answer, /4\. 断暖条件与办理时间/);
      assert.match(answers[0].answer, /9\. 暖气不热与维修/);
      assert.match(answers[0].answer, /模拟规则/);
    }
    const view = await records(f.service, f.session.actor);
    assert.equal(view.orders.length, 0);
    assert.equal(view.applications.length, 0);
  } finally { f.close(); }
});

test("口语及明确主题命中知识，未知政策不给正式规定", async () => {
  const f = await fixture();
  try {
    for (const [question, topic, expected] of [
      ["几月开始烧暖气？", "供暖时间", /11月15日/],
      ["供暖费怎么算？", "供暖费怎么算", /每平方米25元/],
      ["费用", "供暖费怎么算", /每平方米25元/],
      ["绑定需要身份证吗", "房屋绑定与多套房屋", /不收集真实身份证/],
      ["断暖条件与办理时间", "断暖条件与办理时间", /不设置办理截止日期/],
      ["需要什么材料", "断暖材料要求", /产权证明或合同、断暖施工照片/],
      ["退回了怎么补件", "审核进度与退回补件", /继续原工单/],
      ["断暖为什么还缴费", "断暖费用怎么算", /35%/],
      ["可以退费吗", "缴费与模拟电子发票", /未包含退费/],
      ["暖气一直不热怎么办", "暖气不热与维修", /不支持报修派单/],
      ["当地室温必须达到多少度", "暖气不热与维修", /演示资料未包含当地正式室温标准/],
      ["市政府对提前开栓的规定是什么", "未收录", /演示资料未包含/],
    ] as const) {
      const { answers } = resultSchema.parse(await f.service.execute(f.session.actor, { name: "query_policy", input: { question } }));
      const entry = answers.find(item => item.topic === topic);
      assert.ok(entry, `${question} 应命中 ${topic}`);
      assert.match(entry.answer, expected);
      assert.ok(answers.every(item => item.topic !== "政策咨询目录"));
    }
  } finally { f.close(); }
});
