// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Config } from "./config.js";
import { discoverLocalModels } from "./discovery.js";
import { Gateway, GatewayError, limits } from "./gateway.js";
import { scannerStatus } from "./policy.js";
export function createApp(
  config: Config,
  gateway = new Gateway(config),
  options: { personalSession?: boolean } = {},
) {
  config = structuredClone(config);
  const runtimeSelection = options.personalSession === true;
  if (
    runtimeSelection &&
    (!config.auth ||
      config.host !== "127.0.0.1" ||
      config.cloudEnabled ||
      config.cloud ||
      config.classifier ||
      config.local?.key)
  ) {
    gateway.dispose();
    throw new Error(
      "Personal sessions require authenticated loopback and no cloud or classifier configuration",
    );
  }
  let generation = 0;
  let selectionSequence = 0;
  let disposed = false;
  const configuredLocal = () =>
    config.local ? { url: config.local.url, model: config.local.model } : null;
  const current = () => {
    if (disposed) throw new GatewayError("session_changed", 409);
    const captured = gateway;
    const version = generation;
    return {
      gateway: captured,
      checked<T>(value: T): T {
        if (disposed || version !== generation)
          throw new GatewayError("session_changed", 409);
        return value;
      },
    };
  };
  const app = new Hono();
  let windowStart = Date.now();
  let count = 0;
  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Cache-Control", "no-store");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    c.header("Referrer-Policy", "no-referrer");
    await next();
  });
  app.use("/api/*", async (c, next) => {
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      count = 0;
    }
    if (++count > 120) return c.json({ error: "rate_limited" }, 429);
    if (
      !config.auth &&
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(c.req.url).hostname)
    )
      return c.json({ error: "host_forbidden" }, 403);
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin)
      return c.json({ error: "origin_forbidden" }, 403);
    if (config.auth) {
      const actual = createHash("sha256")
        .update(c.req.header("authorization") ?? "")
        .digest();
      const wanted = createHash("sha256")
        .update(`Bearer ${config.auth}`)
        .digest();
      if (!timingSafeEqual(actual, wanted))
        return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 100_000,
      onError: (c) => c.json({ error: "request_too_large" }, 413),
    }),
  );
  app.get("/api/status", (c) =>
    c.json({
      setup: {
        runtimeSelection,
        configuredLocal: runtimeSelection ? configuredLocal() : null,
      },
      mode: config.local ? "local_provider" : "synthetic",
      scanner: scannerStatus(),
      cloudEnabled: config.cloudEnabled,
      classifier: config.classifier ? "local_advisory" : "disabled",
      policyRevision: config.revision,
      limits,
      provider: {
        local: config.local ? "local" : "synthetic",
        cloud: config.cloudEnabled ? "configured" : "disabled",
      },
    }),
  );
  // Coalesce repeat clicks and bound discovery to one probe pair per five seconds.
  let discovery: ReturnType<typeof discoverLocalModels> | undefined;
  let discoveryAt = 0;
  app.get("/api/setup/discover", async (c) => {
    if (!config.auth) return c.json({ error: "setup_token_required" }, 403);
    if (!discovery || Date.now() - discoveryAt >= 5000) {
      discoveryAt = Date.now();
      discovery = discoverLocalModels();
    }
    return c.json({
      scope: "gateway_loopback",
      requiresRestart: !runtimeSelection,
      configuredLocal: configuredLocal(),
      providers: await discovery,
    });
  });
  const body = async (c: {
    req: {
      header: (s: string) => string | undefined;
      json: () => Promise<unknown>;
    };
  }) => {
    if (!c.req.header("content-type")?.startsWith("application/json"))
      throw new GatewayError("json_required");
    return c.req.json();
  };
  const requestSchema = z
    .object({ requestId: z.string().regex(/^[a-f0-9]{48}$/) })
    .strict();
  let selectionDiscovery: ReturnType<typeof discoverLocalModels> | undefined;
  app.post("/api/setup/select", async (c) => {
    if (!runtimeSelection)
      throw new GatewayError("runtime_selection_disabled", 403);
    if (disposed) throw new GatewayError("session_changed", 409);
    const data = z
      .object({
        providerId: z.enum(["ollama", "openai_compatible"]),
        model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/),
      })
      .strict()
      .parse(await body(c));
    const sequence = ++selectionSequence;
    // Revalidate on each selection, sharing only concurrent probes, never cached results.
    selectionDiscovery ??= discoverLocalModels();
    const pending = selectionDiscovery;
    let providers: Awaited<typeof pending>;
    try {
      providers = await pending;
    } finally {
      if (selectionDiscovery === pending) selectionDiscovery = undefined;
    }
    if (disposed) throw new GatewayError("session_changed", 409);
    if (sequence !== selectionSequence)
      throw new GatewayError("selection_superseded", 409);
    const provider = providers.find(
      (candidate) =>
        candidate.id === data.providerId &&
        candidate.status === "available" &&
        candidate.models.includes(data.model),
    );
    if (!provider) throw new GatewayError("model_unavailable", 409);
    const nextConfig: Config = {
      ...config,
      local: { url: provider.url, model: data.model },
      cloudEnabled: false,
      cloud: undefined,
      classifier: undefined,
    };
    const replacement = new Gateway(nextConfig);
    const previous = gateway;
    gateway = replacement;
    config = nextConfig;
    generation++;
    previous.dispose();
    discovery = undefined;
    return c.json({
      mode: "local_provider",
      configuredLocal: configuredLocal(),
      cloudEnabled: false,
    });
  });
  app.post("/api/inspect", async (c) => {
    const session = current();
    return c.json(
      session.checked(await session.gateway.inspectReviewed(await body(c))),
    );
  });
  app.post("/api/local", async (c) => {
    const session = current();
    const data = requestSchema.parse(await body(c));
    return c.json(session.checked(await session.gateway.local(data.requestId)));
  });
  app.post("/api/approve", async (c) => {
    const session = current();
    const data = requestSchema
      .extend({ payloadHash: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(await body(c));
    return c.json(
      session.checked(
        session.gateway.approve(data.requestId, data.payloadHash),
      ),
    );
  });
  app.post("/api/cloud", async (c) => {
    const session = current();
    const data = z
      .object({ receipt: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await body(c));
    return c.json(session.checked(await session.gateway.cloud(data.receipt)));
  });
  for (const [path, file, type] of [
    ["/", "demo/index.html", "text/html; charset=utf-8"],
    ["/style.css", "demo/style.css", "text/css; charset=utf-8"],
    ["/app.js", "dist/demo/app.js", "text/javascript; charset=utf-8"],
  ] as const) {
    app.get(path, async (c) => {
      c.header("Content-Type", type);
      return c.body(await readFile(file, "utf8"));
    });
  }
  app.onError((error, c) => {
    if (error instanceof GatewayError)
      return c.json({ error: error.code }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return c.json({ error: "invalid_input" }, 400);
    return c.json({ error: "internal_error" }, 500);
  });
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return Object.assign(app, {
    dispose() {
      disposed = true;
      generation++;
      selectionSequence++;
      gateway.dispose();
    },
  });
}
