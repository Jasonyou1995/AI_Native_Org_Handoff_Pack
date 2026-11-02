// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { discoverLocalModels } from "../src/discovery.js";
import { Gateway } from "../src/gateway.js";
import { callProvider } from "../src/provider.js";

const endpoint = {
  url: "https://provider.example/v1/chat/completions",
  model: "test-model",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
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

it("discovers only two fixed loopback endpoints without secrets or redirects", async () => {
  const mock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("/api/tags")
            ? {
                models: [
                  { name: "toy:latest" },
                  { name: "toy:latest" },
                  { name: "remote:cloud" },
                  { name: "remote", remote_host: "https://cloud.example" },
                ],
              }
            : { data: [{ id: "org/toy-model" }] },
        ),
      ),
  );
  vi.stubGlobal("fetch", mock);
  const found = await discoverLocalModels();
  expect(found.map((provider) => provider.models)).toEqual([
    ["toy:latest"],
    ["org/toy-model"],
  ]);
  expect(found.every((provider) => provider.status === "available")).toBe(true);
  expect(mock.mock.calls.map((call) => call[0])).toEqual([
    "http://127.0.0.1:11434/api/tags",
    "http://127.0.0.1:1234/v1/models",
  ]);
  for (const call of mock.mock.calls) {
    const options = (call as unknown as [string, RequestInit])[1];
    expect(options.redirect).toBe("error");
    expect(options.method).toBe("GET");
    expect(options.headers).toEqual({ accept: "application/json" });
    expect(options.body).toBeUndefined();
  }
});
it("discovery bounds responses and rejects model IDs unsafe for config snippets", async () => {
  for (const body of [
    "x".repeat(65537),
    '{"models":[{"name":"x\\nCLOUD_ENABLED=true"}]}',
    '{"models":[]',
    '{"models":' +
      JSON.stringify(Array.from({ length: 101 }, () => ({ name: "toy" }))) +
      "}",
  ]) {
    vi.stubGlobal("fetch", async () => new Response(body));
    const found = await discoverLocalModels();
    expect(
      found.every(
        (provider) =>
          provider.status === "invalid_response" &&
          provider.models.length === 0,
      ),
    ).toBe(true);
  }
});
it("discovery distinguishes empty services from unavailable services", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url.endsWith("/api/tags")
      ? new Response('{"models":[]}')
      : new Response("denied", { status: 401 }),
  );
  expect(
    (await discoverLocalModels()).map((provider) => provider.status),
  ).toEqual(["empty", "unavailable"]);
});
it("discovery aborts unavailable loopback services within its deadline", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) =>
        options.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  );
  const pending = discoverLocalModels();
  await vi.advanceTimersByTimeAsync(2001);
  expect(
    (await pending).every((provider) => provider.status === "unavailable"),
  ).toBe(true);
});
it("setup discovery requires authentication, coalesces probes and never exposes provider keys", async () => {
  const config = loadConfig({
    GATEWAY_TOKEN: "test-gateway-token",
    LOCAL_URL: "http://127.0.0.1:11434/v1/chat/completions",
    LOCAL_MODEL: "toy",
    LOCAL_API_KEY: "synthetic-private-key",
  });
  const gateway = new Gateway(config);
  const app = createApp(config, gateway);
  const mock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("/api/tags")
            ? { models: [{ name: "toy" }] }
            : { data: [] },
        ),
      ),
  );
  vi.stubGlobal("fetch", mock);
  try {
    expect(
      (await app.request("http://127.0.0.1/api/setup/discover")).status,
    ).toBe(401);
    expect(mock).not.toHaveBeenCalled();
    const headers = { authorization: "Bearer test-gateway-token" };
    expect(
      (
        await app.request("http://127.0.0.1/api/setup/discover", {
          headers: { ...headers, origin: "https://untrusted.example" },
        })
      ).status,
    ).toBe(403);
    const [first, second] = await Promise.all([
      app.request("http://127.0.0.1/api/setup/discover", { headers }),
      app.request("http://127.0.0.1/api/setup/discover", { headers }),
    ]);
    expect(first.status).toBe(200);
    const text = await first.text();
    expect(text).not.toContain("synthetic-private-key");
    expect(JSON.parse(text)).toMatchObject({
      scope: "gateway_loopback",
      requiresRestart: true,
      configuredLocal: { model: "toy" },
    });
    expect(second.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(config.local?.model).toBe("toy");
  } finally {
    gateway.dispose();
  }
});
it("anonymous synthetic demo cannot probe local services", async () => {
  const config = loadConfig({});
  const gateway = new Gateway(config);
  vi.stubGlobal("fetch", vi.fn());
  try {
    const response = await createApp(config, gateway).request(
      "http://127.0.0.1/api/setup/discover",
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "setup_token_required" });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    gateway.dispose();
  }
});

it("personal launcher choices and config cannot inherit cloud credentials or arbitrary endpoints", async () => {
  const { localChoices, personalConfig } = await import("../src/personal.js");
  vi.stubEnv("CLOUD_ENABLED", "true");
  vi.stubEnv("CLOUD_API_KEY", "synthetic-inherited-key");
  try {
    const choices = localChoices([
      {
        id: "ollama",
        label: "Ollama",
        url: "http://127.0.0.1:11434/v1/chat/completions",
        models: ["toy"],
        status: "available",
      },
    ]);
    const config = personalConfig(choices[0]);
    expect(config.local?.model).toBe("toy");
    expect(config.host).toBe("127.0.0.1");
    expect(config.auth).toMatch(/^[a-f0-9]{64}$/);
    expect(config.auth).not.toBe(personalConfig().auth);
    expect(config.cloudEnabled).toBe(false);
    expect(config.cloud).toBeUndefined();
    expect(config.local?.key).toBeUndefined();
    expect(personalConfig().local).toBeUndefined();
    expect(() =>
      personalConfig({
        label: "evil",
        url: "http://169.254.169.254/",
        model: "toy",
      }),
    ).toThrow();
    expect(() =>
      personalConfig({
        label: "evil",
        url: choices[0]?.url ?? "",
        model: "toy\nCLOUD_ENABLED=true",
      }),
    ).toThrow();
  } finally {
    vi.unstubAllEnvs();
  }
});
