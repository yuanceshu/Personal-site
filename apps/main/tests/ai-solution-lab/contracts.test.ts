import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  briefSchema,
  diagnosisSchema,
  requestSchema,
} from "@/lib/works/ai-solution-lab/schema";
import {
  validatePrototype,
  buildPrototype,
  diagnoseExample,
} from "@/lib/works/ai-solution-lab/planner";
import { examples } from "@/content/projects/ai-solution-lab/catalog";
import {
  metricDatasets,
  getStats,
  type MetricRef,
} from "@/content/projects/ai-solution-lab/datasets";

const cases = JSON.parse(
  readFileSync(
    "../../services/experiment-agents/tests/fixtures/contracts.json",
    "utf8",
  ),
);
for (const c of cases)
  test(c.name, () => {
    let valid = false;
    try {
      if (c.kind === "brief") briefSchema.parse(c.value);
      else if (c.kind === "request") requestSchema.parse(c.value);
      else
        validatePrototype(
          briefSchema.parse(c.value.brief),
          diagnosisSchema.parse(c.value.diagnosis),
          c.value.prototype,
        );
      valid = true;
    } catch {
      /* Expected rejection is part of the contract fixtures. */
    }
    assert.equal(valid, c.valid);
  });
for (const example of examples)
  test(`offline ${example.id} flow`, () => {
    const brief = briefSchema.parse(example.brief);
    const diagnosis = diagnoseExample(brief);
    assert.ok(
      validatePrototype(brief, diagnosis, buildPrototype(brief, diagnosis)),
    );
  });
test("no AI example contains no AI-only module", () => {
  const brief = briefSchema.parse({
    ...examples[0].brief,
    aiPreference: "none",
  });
  const diagnosis = diagnoseExample(brief);
  const spec = buildPrototype(brief, diagnosis);
  assert.ok(
    spec.pages.every((p) =>
      p.sections.every((s) =>
        s.components.every((c) => !["Insight", "Query"].includes(c.type)),
      ),
    ),
  );
});
for (const ref of Object.keys(metricDatasets) as MetricRef[])
  test(`${ref} totals and prior period agree`, () => {
    const current = getStats(ref, "week");
    const previous = getStats(ref, "previous");
    assert.equal(current.data.previous, previous.total);
    assert.equal(
      current.total,
      current.data.visits.reduce((a, b) => a + b, 0),
    );
    assert.equal(current.minimum, Math.min(...current.data.visits));
    assert.equal(
      Number(current.change),
      Number(
        (((current.total - previous.total) / previous.total) * 100).toFixed(1),
      ),
    );
  });
