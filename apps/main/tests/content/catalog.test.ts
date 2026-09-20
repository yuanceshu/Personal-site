import { test } from "node:test";
import assert from "node:assert/strict";
import { getWork, getWorksByCategory, works } from "../../content/projects/catalog";

test("work metadata has unique ids and valid parent relationships", () => {
  assert.equal(new Set(works.map((work) => work.id)).size, works.length);
  for (const work of works) {
    assert.equal(getWork(work.id), work);
    if (work.parentId) assert.ok(works.some((parent) => parent.id === work.parentId));
  }
});

test("current content categories map to stable work entities", () => {
  assert.deepEqual(getWorksByCategory("industry").map((work) => work.id), [
    "demos",
    "island-travel",
    "restaurant-ai",
  ]);
  assert.deepEqual(getWorksByCategory("teaching").map((work) => work.id), ["project-000"]);
  assert.deepEqual(getWorksByCategory("experiment").map((work) => work.id), [
    "ai-solution-lab",
    "ui-lab",
    "ai-life-comics",
  ]);
  assert.deepEqual(getWorksByCategory("creation").map((work) => work.id), ["jingmiansen"]);
  assert.equal(getWork("jingmiansen").linkType, "standalone-app");
});
