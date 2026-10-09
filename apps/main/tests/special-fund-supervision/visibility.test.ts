import test from "node:test"; import assert from "node:assert/strict"; import { demos } from "@/content/projects/demos/catalog";
test("专项资金监管 Demo 保持路径可用但不注册到公开合集",()=>{assert.equal(demos.some(d=>String(d.id)==="special-fund-supervision"),false);assert.equal(demos.some(d=>d.href.includes("special-fund-supervision")),false);});
