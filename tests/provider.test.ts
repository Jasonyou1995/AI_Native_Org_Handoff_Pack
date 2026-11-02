// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { afterEach, expect, it, vi } from "vitest";
import { callProvider } from "../src/provider.js";

const endpoint = {
  url: "https://provider.example/v1/chat/completions",
  model: "test-model",
};
afterEach(() => vi.unstubAllGlobals());
it("uses a fixed nonstreaming request with redirect rejection", async () => {
  const mock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "safe" } }] }),
      ),
  );
  vi.stubGlobal("fetch", mock);
  expect(await callProvider(endpoint, "redacted")).toBe("safe");
  const args = mock.mock.calls[0] as unknown as [string, RequestInit];
  expect(args[1].redirect).toBe("error");
  expect(JSON.parse(String(args[1].body)).stream).toBe(false);
});
it("bounds response size and sanitizes malformed replies", async () => {
  vi.stubGlobal("fetch", async () => new Response("a".repeat(140000)));
  await expect(callProvider(endpoint, "redacted")).rejects.toThrow(
    "Provider unavailable",
  );
  vi.stubGlobal("fetch", async () => new Response('{"raw":"private"}'));
  await expect(callProvider(endpoint, "redacted")).rejects.toThrow(
    "Provider unavailable",
  );
});
