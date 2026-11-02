// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { Gateway } from "../src/gateway.js";

const config = () =>
  loadConfig({
    CLOUD_ENABLED: "true",
    CLOUD_URL: "https://provider.example/v1/chat/completions",
    CLOUD_MODEL: "synthetic-test",
  });
describe("privacy gateway scenarios, not legacy handoff scenarios", () => {
  it("defaults to synthetic local and single use", async () => {
    const g = new Gateway(loadConfig({}));
    const r = g.inspect({ prompt: "hello" });
    expect(r.route).toBe("local");
    expect((await g.local(r.requestId)).provider).toBe("synthetic");
    await expect(g.local(r.requestId)).rejects.toThrow();
  });
  it("unknown and confidential stay local even when cloud enabled", () => {
    const g = new Gateway(config());
    for (const classification of ["unknown", "confidential"])
      expect(
        g.inspect({ prompt: "hello", classification, mode: "hybrid" }).route,
      ).toBe("local");
  });
  it("approved redacted request alone reaches cloud, then scoped rehydration", async () => {
    let sent = "";
    const g = new Gateway(config(), async (_e, p) => {
      sent = p;
      return p;
    });
    const r = g.inspect({
      prompt: "hello alice@example.test",
      classification: "public",
      mode: "hybrid",
    });
    expect(r.route).toBe("approval_required");
    const a = g.approve(r.requestId, r.payloadHash);
    const result = await g.cloud(a.receipt);
    expect(sent).not.toContain("alice@example.test");
    expect(result.output).toContain("alice@example.test");
    expect(result.restoredCount).toBe(1);
  });
  it("never falls back to cloud on local failure", async () => {
    const calls: unknown[] = [];
    const g = new Gateway(config(), async (e) => {
      calls.push(e);
      throw new Error("raw private error");
    });
    const r = g.inspect({ prompt: "hello" });
    await expect(g.local(r.requestId)).rejects.toThrow("provider_unavailable");
    expect(calls).toEqual([undefined]);
  });
  it("supports four text formats and rejects unsupported/binary input", () => {
    const g = new Gateway(loadConfig({}));
    for (const ext of ["txt", "md", "csv", "json"])
      expect(
        g.inspect({
          prompt: "hello",
          files: [{ name: `test.${ext}`, content: "{}" }],
        }).requestId,
      ).toBeTruthy();
    for (const file of [
      { name: "file.pdf", content: "text" },
      { name: "file.txt", content: "abc\u0000def" },
      { name: "file.zip", content: "PK" },
    ])
      expect(() => g.inspect({ prompt: "hello", files: [file] })).toThrow();
  });
  it("API uses strict schemas and auth", async () => {
    const cfg = { ...loadConfig({}), auth: "test-token" };
    const app = createApp(cfg);
    expect((await app.request("http://localhost/api/status")).status).toBe(401);
    expect(
      (
        await app.request("http://localhost/api/status", {
          headers: { authorization: "Bearer test-token" },
        })
      ).status,
    ).toBe(200);
    const response = await app.request("http://localhost/api/inspect", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: "hello",
        url: "https://attacker.example",
      }),
    });
    expect(response.status).toBe(400);
  });
});
it("local advisory classifier can only veto and failures stay local", async () => {
  const cfg = {
    ...config(),
    local: {
      url: "http://127.0.0.1:11434/v1/chat/completions",
      model: "local",
    },
    classifier: {
      url: "http://127.0.0.1:11434/v1/chat/completions",
      model: "classifier",
    },
  };
  for (const decision of ['{"decision":"local"}', "invalid"]) {
    const g = new Gateway(cfg, async () => decision);
    expect(
      (
        await g.inspectReviewed({
          prompt: "hello",
          classification: "public",
          mode: "hybrid",
        })
      ).route,
    ).toBe("local");
  }
  const g = new Gateway(cfg, async () => '{"decision":"review"}');
  expect(
    (
      await g.inspectReviewed({
        prompt: "hello",
        classification: "confidential",
        mode: "hybrid",
      })
    ).route,
  ).toBe("local");
  expect(
    (
      await g.inspectReviewed({
        prompt: "hello",
        classification: "public",
        mode: "hybrid",
      })
    ).route,
  ).toBe("approval_required");
  const failure = new Gateway(cfg, async () => {
    throw new Error("timeout");
  });
  expect(
    (
      await failure.inspectReviewed({
        prompt: "hello",
        classification: "public",
        mode: "hybrid",
      })
    ).route,
  ).toBe("local");
});
it("snapshot configuration cannot be changed after approval", async () => {
  const cfg = config();
  let destination = "";
  const g = new Gateway(cfg, async (e) => {
    destination = e?.url ?? "";
    return "ok";
  });
  const r = g.inspect({
    prompt: "hello",
    classification: "public",
    mode: "hybrid",
  });
  const a = g.approve(r.requestId, r.payloadHash);
  if (cfg.cloud) cfg.cloud.url = "https://attacker.example";
  await g.cloud(a.receipt);
  expect(destination).toBe("https://provider.example/v1/chat/completions");
});
