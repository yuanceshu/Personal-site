import assert from "node:assert/strict";
import test from "node:test";
import { agentConnection } from "@/lib/works/heating/agent/connection";
import { HeatingError } from "@/lib/works/heating/errors";
import { namespace } from "@/lib/works/heating/security";

test("部署配置 fail closed：页面隔离、HTTPS Agent、拒绝 URL 内凭据", () => {
  const saved = { ...process.env };
  const rejected = (error: unknown) => error instanceof HeatingError && error.status === 503;
  try {
    Object.assign(process.env, { NODE_ENV: "production", EXPERIMENT_AGENT_TOKEN: "test-token" });
    assert.equal(namespace(), "page");
    for (const url of ["invalid", "http://127.0.0.1:8002", "https://user:secret@agent.example", "https://agent.example?token=private", "https://agent.example#private"]) {
      process.env.EXPERIMENT_AGENT_URL = url;
      assert.throws(() => agentConnection("https://main.example"), rejected);
    }
    Object.assign(process.env, { EXPERIMENT_AGENT_URL: "https://agent.example", HEATING_AGENT_PROTECTION_BYPASS: "agent-bypass-test", VERCEL_AUTOMATION_BYPASS_SECRET: "main-bypass-test" });
    const connection = agentConnection("https://main.example");
    assert.equal(connection.endpoint.href, "https://agent.example/works/heating/chat");
    assert.equal(connection.headers["X-Heating-Tool-Url"], "https://main.example/api/experiments/heating/tool");
    assert.equal(connection.headers["x-vercel-protection-bypass"], "agent-bypass-test");
    assert.equal(connection.headers["X-Heating-Callback-Bypass"], "main-bypass-test");
    Object.assign(process.env, { NODE_ENV: "development", EXPERIMENT_AGENT_URL: "http://127.0.0.1:8002" });
    delete process.env.VERCEL;
    assert.equal(agentConnection("http://localhost:3000").endpoint.protocol, "http:");
    process.env.VERCEL = "1";
    assert.throws(() => agentConnection("https://main.example"), rejected);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
