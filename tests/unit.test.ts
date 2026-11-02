// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { Gateway } from "../src/gateway.js";
import { inspectText, rehydrate } from "../src/policy.js";

describe("deterministic policy", () => {
  it("redacts identifiers and Chinese organization terms", () => {
    const result = inspectText("alice@example.test 13800138000 幻想公司", [
      "幻想公司",
    ]);
    expect(result.redacted).not.toContain("alice@example.test");
    expect(result.redacted).not.toContain("幻想公司");
    expect(result.findings.map((x) => x.kind)).toEqual(
      expect.arrayContaining(["email", "phone", "organization"]),
    );
    expect(rehydrate(result.redacted, result.mapping)).toBe(
      "alice@example.test 13800138000 幻想公司",
    );
  });
  it("does not rehydrate tokens from another request", () => {
    const a = inspectText("alice@example.test", []);
    const b = inspectText("bob@example.test", []);
    expect(rehydrate(a.redacted, b.mapping)).toBe(a.redacted);
  });
  it("rejects unsafe deployment and provider config", () => {
    expect(() => loadConfig({ HOST: "0.0.0.0" })).toThrow();
    expect(() =>
      loadConfig({ LOCAL_URL: "https://remote.example/v1/chat/completions" }),
    ).toThrow();
    expect(() => loadConfig({ CLOUD_ENABLED: "true" })).toThrow();
  });
});
it("overlap merging never scans generated token text", () => {
  for (let i = 0; i < 100; i++) {
    const original = "PG alice@example.test 13800138000 幻想公司";
    const result = inspectText(original, [
      "PG",
      "alice",
      "幻想",
      "幻想公司",
      "123",
      "abc",
    ]);
    expect(rehydrate(result.redacted, result.mapping)).toBe(original);
    expect(
      [...result.mapping.values()].every((value) => !value.includes("[[PG_")),
    ).toBe(true);
    expect(result.redacted).not.toContain("example.test");
  }
}, 15_000);
it("bounds detection amplification and final restoration", () => {
  expect(() =>
    inspectText("a".repeat(32768), ["a", "b", "c", "d", "e", "f"]),
  ).toThrow("capacity");
  const inspection = inspectText("1".repeat(30000), []);
  expect(() =>
    rehydrate(inspection.redacted.repeat(5), inspection.mapping),
  ).toThrow("Restoration limit");
});
it("background timer clears expired raw content without a new request", () => {
  vi.useFakeTimers();
  const g = new Gateway(loadConfig({}));
  try {
    const result = g.inspect({ prompt: "alice@example.test" });
    const records = Reflect.get(g, "requests") as Map<
      string,
      { original: string; inspection: { mapping: Map<string, string> } }
    >;
    const record = records.get(result.requestId);
    expect(record?.original).toContain("alice@example.test");
    vi.advanceTimersByTime(121000);
    expect(records.size).toBe(0);
    expect(record?.original).toBe("");
    expect(record?.inspection.mapping.size).toBe(0);
  } finally {
    g.dispose();
    vi.useRealTimers();
  }
});
