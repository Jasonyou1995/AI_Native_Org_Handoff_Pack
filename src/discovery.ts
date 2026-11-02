// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { z } from "zod";

const modelId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/);
const ollamaModels = z.object({
  models: z
    .array(
      z.object({
        name: modelId,
        remote_host: z.string().optional(),
        remote_model: z.string().optional(),
      }),
    )
    .max(100),
});
const compatibleModels = z.object({
  data: z.array(z.object({ id: modelId })).max(100),
});
const candidates = [
  {
    id: "ollama",
    label: "Ollama",
    probe: "http://127.0.0.1:11434/api/tags",
    url: "http://127.0.0.1:11434/v1/chat/completions",
  },
  {
    id: "openai_compatible",
    label: "OpenAI-compatible local server",
    probe: "http://127.0.0.1:1234/v1/models",
    url: "http://127.0.0.1:1234/v1/chat/completions",
  },
] as const;
export type DiscoveredProvider = {
  id: "ollama" | "openai_compatible";
  label: string;
  url: string;
  status: "available" | "empty" | "unavailable" | "invalid_response";
  models: string[];
};

/** Read-only discovery: fixed numeric loopback destinations, never caller URLs or credentials. */
export async function discoverLocalModels(): Promise<DiscoveredProvider[]> {
  return Promise.all(
    candidates.map(async (candidate): Promise<DiscoveredProvider> => {
      const result: DiscoveredProvider = {
        id: candidate.id,
        label: candidate.label,
        url: candidate.url,
        status: "unavailable",
        models: [],
      };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(candidate.probe, {
          method: "GET",
          redirect: "error",
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok || !response.body) return result;
        result.status = "invalid_response";
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65536) {
            await reader.cancel();
            return result;
          }
          chunks.push(value);
        }
        const parsed: unknown = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            Buffer.concat(chunks),
          ),
        );
        const ids =
          candidate.id === "ollama"
            ? ollamaModels
                .parse(parsed)
                .models.filter(
                  (model) => !model.remote_host && !model.remote_model,
                )
                .map((model) => model.name)
            : compatibleModels.parse(parsed).data.map((model) => model.id);
        // Obvious cloud aliases are not suggested as local inference. A local server
        // may still proxy remotely; discovery cannot certify its execution locality.
        result.models = [...new Set(ids.filter((id) => !/:cloud$/i.test(id)))];
        result.status = result.models.length ? "available" : "empty";
        return result;
      } catch {
        return result;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}
