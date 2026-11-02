// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { Config } from "./config.js";
import { Gateway, GatewayError, limits } from "./gateway.js";
import { scannerStatus } from "./policy.js";
export function createApp(config: Config, gateway = new Gateway(config)) {
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
  app.post("/api/inspect", async (c) =>
    c.json(await gateway.inspectReviewed(await body(c))),
  );
  app.post("/api/local", async (c) => {
    const data = requestSchema.parse(await body(c));
    return c.json(await gateway.local(data.requestId));
  });
  app.post("/api/approve", async (c) => {
    const data = requestSchema
      .extend({ payloadHash: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(await body(c));
    return c.json(gateway.approve(data.requestId, data.payloadHash));
  });
  app.post("/api/cloud", async (c) => {
    const data = z
      .object({ receipt: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(await body(c));
    return c.json(await gateway.cloud(data.receipt));
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
  return app;
}
