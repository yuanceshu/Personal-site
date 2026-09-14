import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/experiments/ai-solution-lab/route";

const url = "http://localhost:3100/api/experiments/ai-solution-lab";
const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3100",
};
const payload = JSON.stringify({
  stage: "analyze",
  input: "医院希望整理经营数据并查看变化",
});
test("proxy requires same origin and JSON", async () => {
  assert.equal(
    (await POST(new Request(url, { method: "POST", body: payload }))).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request(url, {
          method: "POST",
          headers: { ...headers, Origin: "http://evil.test" },
          body: payload,
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await POST(
        new Request(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "text/plain" },
          body: payload,
        }),
      )
    ).status,
    415,
  );
});
test("proxy rejects excess body and arbitrary stage", async () => {
  assert.equal(
    (
      await POST(
        new Request(url, { method: "POST", headers, body: "x".repeat(32769) }),
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await POST(
        new Request(url, {
          method: "POST",
          headers,
          body: '{"stage":"execute"}',
        }),
      )
    ).status,
    400,
  );
});
test("proxy missing config is explicit", async () => {
  const savedUrl = process.env.EXPERIMENT_AGENT_URL;
  const savedToken = process.env.EXPERIMENT_AGENT_TOKEN;
  try {
    delete process.env.EXPERIMENT_AGENT_URL;
    delete process.env.EXPERIMENT_AGENT_TOKEN;
    const response = await POST(
      new Request(url, { method: "POST", headers, body: payload }),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    if (savedUrl === undefined) delete process.env.EXPERIMENT_AGENT_URL;
    else process.env.EXPERIMENT_AGENT_URL = savedUrl;
    if (savedToken === undefined) delete process.env.EXPERIMENT_AGENT_TOKEN;
    else process.env.EXPERIMENT_AGENT_TOKEN = savedToken;
  }
});
