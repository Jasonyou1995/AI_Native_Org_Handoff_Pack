// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { type Config, loadConfig } from "./config.js";
import type { DiscoveredProvider } from "./discovery.js";
import { Gateway } from "./gateway.js";

export type LocalChoice = { label: string; url: string; model: string };
export function localChoices(providers: DiscoveredProvider[]): LocalChoice[] {
  return providers.flatMap((provider) =>
    provider.status === "available"
      ? provider.models.map((model) => ({
          label: `${provider.label}: ${model}`,
          url: provider.url,
          model,
        }))
      : [],
  );
}
export function personalConfig(choice?: LocalChoice): Config {
  // Only destinations in the detector's fixed allowlist can be selected here.
  if (
    choice &&
    (![
      "http://127.0.0.1:11434/v1/chat/completions",
      "http://127.0.0.1:1234/v1/chat/completions",
    ].includes(choice.url) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/.test(choice.model))
  ) {
    throw new Error("Unsupported personal model selection");
  }
  return loadConfig({
    HOST: "127.0.0.1",
    PORT: "3000",
    GATEWAY_TOKEN: randomBytes(32).toString("hex"),
    CLOUD_ENABLED: "false",
    ...(choice ? { LOCAL_URL: choice.url, LOCAL_MODEL: choice.model } : {}),
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--demo") || args.length > 1) {
    throw new Error("Usage: npm run personal [-- --demo]");
  }
  const config = personalConfig();
  const gateway = new Gateway(config);
  const app = createApp(config, gateway, { personalSession: true });
  const server = serve(
    {
      hostname: config.host,
      port: config.port,
      fetch: app.fetch,
    },
    () => {
      console.log(`Open http://127.0.0.1:${config.port}`);
      console.log(`Gateway token (this process only): ${config.auth}`);
      console.log(
        "Synthetic demo until you choose a local model in Settings. No model downloads or cloud inference happen automatically.",
      );
      console.log(
        "Cloud is disabled. Keep this terminal open. Ctrl+C stops the app and discards in-memory requests.",
      );
    },
  );
  if ("requestTimeout" in server) server.requestTimeout = 20_000;
  if ("headersTimeout" in server) server.headersTimeout = 10_000;
  const shutdown = () => {
    app.dispose();
    server.close();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  server.on("error", () => {
    shutdown();
    console.error(
      "Could not start personal gateway. Check whether port 3000 is already in use.",
    );
    process.exitCode = 1;
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Personal setup failed",
    );
    process.exitCode = 1;
  });
}
