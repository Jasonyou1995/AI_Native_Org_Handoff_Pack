// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { Gateway } from "./gateway.js";

try {
  const config = loadConfig();
  const gateway = new Gateway(config);
  const server = serve({
    fetch: createApp(config, gateway).fetch,
    hostname: config.host,
    port: config.port,
  });
  if ("requestTimeout" in server) server.requestTimeout = 20_000;
  if ("headersTimeout" in server) server.headersTimeout = 10_000;
  const shutdown = () => {
    gateway.dispose();
    server.close();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  server.on("error", () => {
    shutdown();
    process.stderr.write(
      "Gateway startup failed. Check server configuration.\n",
    );
    process.exitCode = 1;
  });
} catch {
  process.stderr.write("Gateway startup failed. Check server configuration.\n");
  process.exitCode = 1;
}
