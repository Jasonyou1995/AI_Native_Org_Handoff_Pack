// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { Gateway } from "../src/gateway.js";
import { inspectText, rehydrate } from "../src/policy.js";
import { scanWithRust } from "../src/rust-core.js";

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

const active: Gateway[] = [];
const configured = () =>
  loadConfig({
    CLOUD_ENABLED: "true",
    CLOUD_URL: "https://provider.example/v1/chat/completions",
    CLOUD_MODEL: "synthetic-security-test",
  });
const input = {
  prompt: "Synthetic public note",
  classification: "public",
  mode: "hybrid",
};
function gateway(...args: ConstructorParameters<typeof Gateway>) {
  const g = new Gateway(...args);
  active.push(g);
  return g;
}
afterEach(() => {
  for (const g of active.splice(0)) g.dispose();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("independent security regressions with default Rust scanner", () => {
  it("blocks case-insensitive private key markers", () => {
    const g = gateway(configured());
    for (const prompt of [
      "-----begin private key-----\nsynthetic",
      "-----BEGIN rsa PRIVATE KEY-----\nsynthetic",
    ])
      expect(g.inspect({ ...input, prompt }).route).toBe("local");
  });
  it("blocks credentials separated by long permitted whitespace", () => {
    const g = gateway(configured());
    for (const prompt of [
      `password${" ".repeat(65)}=synthetic-value`,
      `api_key=${"\t".repeat(65)}synthetic-value`,
    ])
      expect(g.inspect({ ...input, prompt }).route).toBe("local");
  });
  it("round trips non-BMP and casefolded literal organization terms", () => {
    for (const text of [
      "😀 👩‍💻 Acme a@example.invalid 中文",
      "𐐀 𐐨 contact alice@example.invalid",
      "前缀 K 后缀 K",
    ]) {
      const r = inspectText(text, ["Acme", "𐐨", "K"]);
      expect(rehydrate(r.redacted, r.mapping)).toBe(text);
      expect(r.redacted).not.toContain("@example.invalid");
    }
  });
  it("rejects unpaired Unicode and over-byte-limit valid Unicode", () => {
    const g = gateway(configured());
    expect(() => g.inspect({ ...input, prompt: "\ud800" })).toThrow(
      "unsupported_text",
    );
    expect(() =>
      g.inspect({
        ...input,
        files: [{ name: "toy.txt", content: "😀".repeat(9000) }],
      }),
    ).toThrow("file_too_large");
    expect(() => scanWithRust("\ud800", [])).toThrow();
  });
  it("never invokes provider for inspection or rejected approval", () => {
    const provider = vi.fn(async () => "synthetic");
    const g = gateway(configured(), provider);
    for (const classification of ["unknown", "confidential"]) {
      const r = g.inspect({ ...input, classification });
      expect(r.route).toBe("local");
      expect(() => g.approve(r.requestId, r.payloadHash)).toThrow(
        "cloud_forbidden",
      );
    }
    expect(provider).not.toHaveBeenCalled();
  });
  it("expires approval at the exact inspection deadline without extending TTL", async () => {
    let now = 1000;
    const provider = vi.fn(async () => "synthetic");
    const g = gateway(configured(), provider, () => now);
    const r = g.inspect(input);
    now = r.expiresAt - 1;
    const a = g.approve(r.requestId, r.payloadHash);
    expect(a.expiresAt).toBe(r.expiresAt);
    now++;
    await expect(g.cloud(a.receipt)).rejects.toThrow(
      "receipt_missing_or_expired",
    );
    expect(provider).not.toHaveBeenCalled();
  });
  it("local consumption invalidates an already approved cloud receipt", async () => {
    const provider = vi.fn(async () => "synthetic");
    const g = gateway(configured(), provider);
    const r = g.inspect(input);
    const a = g.approve(r.requestId, r.payloadHash);
    await g.local(r.requestId);
    await expect(g.cloud(a.receipt)).rejects.toThrow();
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(undefined, input.prompt);
  });
  it("fails closed on broken Rust executable without invoking provider", () => {
    vi.stubEnv("PRIVACY_SCANNER_BIN", "/nonexistent/synthetic-scanner");
    const provider = vi.fn(async () => "synthetic");
    const g = gateway(configured(), provider);
    expect(() => g.inspect(input)).toThrow("scanner_unavailable");
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects cardinality and expansion attacks before retaining requests", () => {
    const config = configured();
    config.terms = ["a", "b", "c", "d", "e", "f"];
    const g = gateway(config);
    expect(() => g.inspect({ ...input, prompt: "a".repeat(10000) })).toThrow(
      "inspection_limit",
    );
    expect(g.inspect(input).route).toBe("approval_required");
  });
  it("enforces auth, null/cross origin, strict payload and transport cap", async () => {
    const cfg = { ...configured(), auth: "synthetic-auth-token-32-characters" };
    const g = gateway(cfg);
    const app = createApp(cfg, g);
    const post = (body: string, extra: Record<string, string> = {}) =>
      app.request("http://localhost/api/inspect", {
        method: "POST",
        headers: {
          authorization: `Bearer ${cfg.auth}`,
          "content-type": "application/json",
          ...extra,
        },
        body,
      });
    expect(
      (await post(JSON.stringify(input), { authorization: "Bearer incorrect" }))
        .status,
    ).toBe(401);
    for (const origin of ["null", "https://attacker.example"])
      expect((await post(JSON.stringify(input), { origin })).status).toBe(403);
    for (const body of [
      "{",
      JSON.stringify({ ...input, endpoint: "https://attacker.example" }),
      JSON.stringify({
        ...input,
        files: [{ name: "toy.txt", content: "safe", classification: "public" }],
      }),
    ])
      expect((await post(body)).status).toBe(400);
    expect((await post(" ".repeat(100001))).status).toBe(413);
  });
  it("enforces process rate cap", async () => {
    const cfg = loadConfig({});
    const g = gateway(cfg);
    const app = createApp(cfg, g);
    for (let i = 0; i < 120; i++)
      expect((await app.request("http://localhost/api/status")).status).toBe(
        200,
      );
    expect((await app.request("http://localhost/api/status")).status).toBe(429);
  });
});

it("blocks credentials adjacent to Chinese text", () => {
  const g = gateway(configured());
  for (const prompt of [
    "示例password=synthetic-value",
    "说明sk-syntheticprivatevalue1234",
    "用户api_key=synthetic-value",
  ])
    expect(g.inspect({ ...input, prompt }).route).toBe("local");
});

it("rejects malformed scanner protocol, unsafe offsets and excessive spans", () => {
  const span = { start: 0, end: 1, kind: "organization" };
  for (const stdout of [
    "not-json",
    JSON.stringify({ version: 2, offsets: "utf16", spans: [], blocked: false }),
    JSON.stringify({
      version: 1,
      offsets: "utf16",
      spans: [span],
      blocked: false,
    }),
    JSON.stringify({
      version: 1,
      offsets: "utf16",
      spans: [{ ...span, end: 99 }],
      blocked: false,
    }),
    JSON.stringify({
      version: 1,
      offsets: "utf16",
      spans: Array.from({ length: 4097 }, () => span),
      blocked: false,
    }),
  ]) {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      signal: null,
      pid: 0,
      output: [],
      stdout,
      stderr: "",
    } as unknown as ReturnType<typeof spawnSync>);
    expect(() => scanWithRust("😀", [])).toThrow("Rust scanner unavailable");
  }
});
it("executes trusted scanner path without shell and with timeout/output caps", () => {
  vi.stubEnv(
    "PRIVACY_SCANNER_BIN",
    "/trusted/synthetic-scanner;not-a-shell-command",
  );
  vi.mocked(spawnSync).mockReturnValueOnce({
    status: 0,
    signal: null,
    pid: 0,
    output: [],
    stdout: JSON.stringify({
      version: 1,
      offsets: "utf16",
      spans: [],
      blocked: false,
    }),
    stderr: "",
  } as unknown as ReturnType<typeof spawnSync>);
  expect(scanWithRust("synthetic", [])).toEqual({ spans: [], blocked: false });
  expect(spawnSync).toHaveBeenLastCalledWith(
    "/trusted/synthetic-scanner;not-a-shell-command",
    [],
    expect.objectContaining({ shell: false, timeout: 5000, maxBuffer: 524288 }),
  );
});
