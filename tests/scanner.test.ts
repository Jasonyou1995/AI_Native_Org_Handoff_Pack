// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { afterEach, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { Gateway } from "../src/gateway.js";
import {
  inspectText,
  rehydrate,
  scannerStatus,
  scanWithTypeScript,
} from "../src/policy.js";
import { scanWithRust } from "../src/rust-core.js";

afterEach(() => vi.unstubAllEnvs());
it("uses Rust as default and preserves Unicode offsets", () => {
  vi.stubEnv("PRIVACY_SCANNER", "rust");
  const text = "😀 幻想公司 alice@example.test 13800138000";
  const result = inspectText(text, ["幻想公司"]);
  expect(scannerStatus()).toEqual({ engine: "rust", available: true });
  expect(rehydrate(result.redacted, result.mapping)).toBe(text);
  expect(result.redacted).not.toContain("alice@example.test");
  expect(result.redacted).not.toContain("幻想公司");
});
it("missing Rust binary fails closed instead of using TypeScript", () => {
  vi.stubEnv("PRIVACY_SCANNER", "rust");
  vi.stubEnv("PRIVACY_SCANNER_BIN", "/nonexistent/privacy-scanner");
  expect(scannerStatus().available).toBe(false);
  const gateway = new Gateway(loadConfig({}));
  try {
    expect(() => gateway.inspect({ prompt: "synthetic" })).toThrow(
      "scanner_unavailable",
    );
  } finally {
    gateway.dispose();
  }
});
it("TypeScript scanner requires explicit configuration", () => {
  vi.stubEnv("PRIVACY_SCANNER", "typescript");
  vi.stubEnv("PRIVACY_SCANNER_BIN", "/nonexistent/privacy-scanner");
  expect(scannerStatus()).toEqual({ engine: "typescript", available: true });
  expect(inspectText("alice@example.test", []).findings).toEqual([
    { kind: "email", count: 1 },
  ]);
});
it("Rust and TypeScript agree on isolated representative detections", () => {
  for (const text of [
    "alice@example.test",
    "13800138000",
    "幻想公司",
    "password=synthetic-private-value",
    "[[PG_forged]]",
  ]) {
    const rust = scanWithRust(text, ["幻想公司"]);
    const ts = scanWithTypeScript(text, ["幻想公司"]);
    expect(rust.blocked).toBe(ts.blocked);
    expect(rust.spans).toEqual(ts.spans);
  }
});
