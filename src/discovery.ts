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

const ollamaInfo = z.object({
  capabilities: z.array(z.string().max(64)).max(32),
  remote_host: z.string().optional(),
  remote_model: z.string().optional(),
});

async function metadata(
  url: string,
  signal: AbortSignal,
  maxBytes: number,
  body?: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.any([signal, controller.signal]),
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
    });
    if (!response.ok || !response.body) throw new Error("unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("invalid_response");
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      ) as unknown;
    } catch {
      throw new Error("invalid_response");
    }
  } finally {
    clearTimeout(timer);
  }
}

async function completionModels(
  ids: string[],
  signal: AbortSignal,
): Promise<string[]> {
  // Metadata only, no prompt/inference/model download. At most 20 candidates,
  // four concurrent requests and the caller's shared aggregate deadline.
  const candidates = ids.slice(0, 20);
  const accepted = new Set<string>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, candidates.length) }, async () => {
      while (!signal.aborted) {
        const id = candidates[next++];
        if (!id) return;
        try {
          const info = ollamaInfo.parse(
            await metadata(
              "http://127.0.0.1:11434/api/show",
              signal,
              262144,
              JSON.stringify({ model: id, verbose: false }),
            ),
          );
          if (
            !info.remote_host &&
            !info.remote_model &&
            info.capabilities.includes("completion")
          )
            accepted.add(id);
        } catch {
          /* Unknown or unsupported capabilities are never suggested. */
        }
      }
    }),
  );
  return candidates.filter((id) => accepted.has(id));
}

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
      const timer = setTimeout(
        () => controller.abort(),
        candidate.id === "ollama" ? 4000 : 2000,
      );
      try {
        const parsed = await metadata(
          candidate.probe,
          controller.signal,
          65536,
        );
        result.status = "invalid_response";
        const ids =
          candidate.id === "ollama"
            ? ollamaModels
                .parse(parsed)
                .models.filter(
                  (model) => !model.remote_host && !model.remote_model,
                )
                .map((model) => model.name)
            : compatibleModels.parse(parsed).data.map((model) => model.id);
        // A local server may still proxy remotely; this is not locality certification.
        const eligible = [...new Set(ids.filter((id) => !/:cloud$/i.test(id)))];
        result.models =
          candidate.id === "ollama"
            ? await completionModels(eligible, controller.signal)
            : eligible;
        result.status = result.models.length ? "available" : "empty";
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_response")
          result.status = "invalid_response";
        return result;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}
