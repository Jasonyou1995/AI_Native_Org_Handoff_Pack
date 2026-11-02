// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { createHash } from "node:crypto";
export type Endpoint = { url: string; model: string; key?: string };
export type Config = {
  host: string;
  port: number;
  auth?: string;
  local?: Endpoint;
  classifier?: Endpoint;
  cloud?: Endpoint;
  cloudEnabled: boolean;
  terms: string[];
  revision: string;
  ttlMs: number;
  capacity: number;
};
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  if (
    env.PRIVACY_SCANNER &&
    !["rust", "typescript"].includes(env.PRIVACY_SCANNER)
  )
    throw new Error("Invalid scanner configuration");
  const host = env.HOST ?? "127.0.0.1";
  const auth = env.GATEWAY_TOKEN;
  if (auth?.startsWith("replace-with-"))
    throw new Error("Replace the example gateway token");
  if (
    !["127.0.0.1", "::1", "localhost"].includes(host) &&
    (!auth || auth.length < 32)
  )
    throw new Error(
      "Non-loopback binding requires a token of at least 32 characters",
    );
  const endpoint = (prefix: "LOCAL" | "CLOUD"): Endpoint | undefined => {
    const raw = env[`${prefix}_URL`];
    if (!raw) return undefined;
    const url = new URL(raw);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new Error("Invalid endpoint");
    const allowedLocalHosts = [
      "127.0.0.1",
      "[::1]",
      "localhost",
      ...(env.LOCAL_ALLOWED_HOSTS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ];
    if (prefix === "LOCAL" && !allowedLocalHosts.includes(url.hostname))
      throw new Error("Local endpoint must be loopback");
    if (prefix === "CLOUD" && url.protocol !== "https:")
      throw new Error("Cloud endpoint requires HTTPS");
    const model = env[`${prefix}_MODEL`];
    if (!model) throw new Error("Configured endpoint requires a model");
    return { url: url.toString(), model, key: env[`${prefix}_API_KEY`] };
  };
  const local = endpoint("LOCAL");
  const cloud = endpoint("CLOUD");
  if (env.CLASSIFIER_MODEL && !local)
    throw new Error("Classifier requires a local endpoint");
  const classifier =
    env.CLASSIFIER_MODEL && local
      ? { ...local, model: env.CLASSIFIER_MODEL }
      : undefined;
  const cloudEnabled = env.CLOUD_ENABLED === "true";
  if (cloudEnabled && !cloud)
    throw new Error("Cloud enablement requires an endpoint");
  const terms = (env.ORG_TERMS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (terms.length > 100 || terms.some((t) => t.length > 100))
    throw new Error("Organization term limits exceeded");
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid port");
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        version: 2,
        scanner: env.PRIVACY_SCANNER ?? "rust",
        terms,
        classifier: classifier?.model,
        cloudEnabled,
        cloud: cloud ? { url: cloud.url, model: cloud.model } : null,
      }),
    )
    .digest("hex");
  return {
    host,
    port,
    auth,
    local,
    classifier,
    cloud,
    cloudEnabled,
    terms,
    revision,
    ttlMs: 120_000,
    capacity: 100,
  };
}
