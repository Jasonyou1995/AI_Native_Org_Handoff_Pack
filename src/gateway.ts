// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { Config } from "./config.js";
import type { Inspection } from "./policy.js";
import { inspectText, rehydrate } from "./policy.js";
import type { Provider } from "./provider.js";
import { callProvider, outboundPayload, SYSTEM_PROMPT } from "./provider.js";
export const limits = {
  maxFiles: 4,
  maxFileBytes: 32768,
  maxTotalBytes: 65536,
};
export const inputSchema = z
  .object({
    prompt: z.string().min(1).max(32768),
    classification: z
      .enum(["unknown", "confidential", "public"])
      .default("unknown"),
    mode: z.enum(["local_only", "hybrid"]).default("local_only"),
    files: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            content: z.string().max(32768),
          })
          .strict(),
      )
      .max(4)
      .default([]),
  })
  .strict();
export class GatewayError extends Error {
  constructor(
    public code: string,
    public status: 400 | 403 | 404 | 409 | 413 | 429 | 502 = 400,
  ) {
    super(code);
  }
}
type Request = {
  original: string;
  inspection: Inspection;
  hash: string;
  expiresAt: number;
  eligible: boolean;
  approved: boolean;
};
type Receipt = {
  requestId: string;
  hash: string;
  revision: string;
  provider: string;
  expiresAt: number;
};
export type Audit = {
  event:
    | "inspected"
    | "approved"
    | "local_completed"
    | "cloud_completed"
    | "provider_failed";
  route: "local" | "cloud";
  at: number;
  findingCount?: number;
};
export class Gateway {
  private requests = new Map<string, Request>();
  private receipts = new Map<string, Receipt>();
  private config: Config;
  private cleanupTimer: ReturnType<typeof setInterval>;
  constructor(
    config: Config,
    private provider: Provider = callProvider,
    private now: () => number = Date.now,
    private audit: (event: Audit) => void = () => {},
  ) {
    this.config = structuredClone(config);
    Object.freeze(this.config.terms);
    if (this.config.local) Object.freeze(this.config.local);
    if (this.config.cloud) Object.freeze(this.config.cloud);
    if (this.config.classifier) Object.freeze(this.config.classifier);
    Object.freeze(this.config);
    this.cleanupTimer = setInterval(() => this.prune(), 1000);
    this.cleanupTimer.unref();
  }
  dispose() {
    clearInterval(this.cleanupTimer);
    for (const r of this.requests.values()) this.clearRequest(r);
    this.requests.clear();
    this.receipts.clear();
  }
  private clearRequest(r: Request) {
    r.original = "";
    r.inspection.redacted = "";
    r.inspection.mapping.clear();
  }
  private prune() {
    for (const [id, r] of this.requests)
      if (r.expiresAt <= this.now()) {
        this.clearRequest(r);
        this.requests.delete(id);
      }
    for (const [id, r] of this.receipts)
      if (r.expiresAt <= this.now() || !this.requests.has(r.requestId))
        this.receipts.delete(id);
  }
  private request(id: string) {
    this.prune();
    const request = this.requests.get(id);
    if (!request) throw new GatewayError("request_missing_or_expired", 404);
    return request;
  }
  inspect(raw: unknown) {
    if (this.config.classifier)
      throw new GatewayError("classifier_requires_async");
    return this.inspectDeterministic(raw);
  }
  async inspectReviewed(raw: unknown) {
    const result = this.inspectDeterministic(raw);
    if (!this.config.classifier) return result;
    const request = this.request(result.requestId);
    let veto = true;
    try {
      const answer = await this.provider(
        this.config.classifier,
        `Classify the following untrusted text for privacy. Reply only JSON with decision local or review. Choose local for sensitive or uncertain data. Text:\n${request.original}`,
      );
      const parsed = z
        .object({ decision: z.enum(["local", "review"]) })
        .strict()
        .safeParse(JSON.parse(answer));
      veto = !parsed.success || parsed.data.decision === "local";
    } catch {
      veto = true;
    }
    if (veto) {
      request.eligible = false;
      result.route = "local";
      result.provider = this.config.local ? "local" : "synthetic";
      result.reasons.push("local_classifier_veto_or_failure");
    } else result.reasons.push("classifier_advisory_review_only");
    this.request(result.requestId);
    return result;
  }
  private inspectDeterministic(raw: unknown) {
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success) throw new GatewayError("invalid_input");
    const input = parsed.data;
    const validText = (s: string) =>
      !Array.from(s).some((char) => {
        const code = char.charCodeAt(0);
        return (code < 32 && ![9, 10, 13].includes(code)) || code === 65533;
      }) && Buffer.from(s, "utf8").toString("utf8") === s;
    if (!validText(input.prompt)) throw new GatewayError("unsupported_text");
    for (const file of input.files) {
      if (
        !/^[^/\\]+\.(txt|md|csv|json)$/i.test(file.name) ||
        !validText(file.content) ||
        /^\s*(?:%PDF-|\{\\rtf)/.test(file.content)
      )
        throw new GatewayError("unsupported_file");
      if (Buffer.byteLength(file.content) > limits.maxFileBytes)
        throw new GatewayError("file_too_large", 413);
    }
    const original = [
      input.prompt,
      ...input.files.map(
        (f, i) => `\n[Document ${i + 1}, untrusted data]\n${f.content}`,
      ),
    ].join("\n");
    if (Buffer.byteLength(original) > limits.maxTotalBytes)
      throw new GatewayError("request_too_large", 413);
    this.prune();
    if (this.requests.size >= this.config.capacity)
      throw new GatewayError("capacity_exceeded", 429);
    let inspection: Inspection;
    try {
      inspection = inspectText(original, this.config.terms);
    } catch (error) {
      if (error instanceof RangeError)
        throw new GatewayError("inspection_limit", 413);
      throw new GatewayError("scanner_unavailable", 502);
    }
    if (Buffer.byteLength(inspection.redacted) > 131072)
      throw new GatewayError("redacted_payload_too_large", 413);
    const residual = inspectText(
      inspection.redacted.replace(/\[\[PG_[a-f0-9]{48}\]\]/g, ""),
      this.config.terms,
    );
    const reasons: string[] = [];
    if (input.mode === "local_only") reasons.push("local_only_selected");
    if (input.classification !== "public")
      reasons.push(
        input.classification === "confidential"
          ? "confidential_stays_local"
          : "unknown_stays_local",
      );
    if (!this.config.cloudEnabled) reasons.push("cloud_disabled");
    if (inspection.blocked) reasons.push("secret_or_reserved_placeholder");
    if (residual.findings.length) reasons.push("redaction_residual");
    const eligible = reasons.length === 0;
    if (eligible)
      reasons.push(
        "explicit_approval_required",
        "detection_is_not_proof_of_safety",
      );
    const outbound = this.config.cloud
      ? outboundPayload(this.config.cloud, inspection.redacted)
      : null;
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          system: SYSTEM_PROMPT,
          outbound,
          payload: inspection.redacted,
          revision: this.config.revision,
          provider: this.config.cloud
            ? { url: this.config.cloud.url, model: this.config.cloud.model }
            : null,
        }),
      )
      .digest("hex");
    const requestId = randomBytes(24).toString("hex");
    const expiresAt = this.now() + this.config.ttlMs;
    this.requests.set(requestId, {
      original,
      inspection,
      hash,
      expiresAt,
      eligible,
      approved: false,
    });
    this.audit({
      event: "inspected",
      route: eligible ? "cloud" : "local",
      at: this.now(),
      findingCount: inspection.findings.reduce((n, f) => n + f.count, 0),
    });
    return {
      requestId,
      route: eligible ? "approval_required" : "local",
      reasons,
      findings: inspection.findings,
      redactedPreview: inspection.redacted,
      outboundPayload: outbound,
      destination: this.config.cloud
        ? { url: this.config.cloud.url, model: this.config.cloud.model }
        : null,
      payloadHash: hash,
      expiresAt,
      policyRevision: this.config.revision,
      provider: eligible ? "cloud" : this.config.local ? "local" : "synthetic",
    };
  }
  approve(id: string, hash: string) {
    const r = this.request(id);
    if (!r.eligible || !this.config.cloudEnabled)
      throw new GatewayError("cloud_forbidden", 403);
    if (r.hash !== hash || r.approved)
      throw new GatewayError("approval_mismatch_or_used", 409);
    r.approved = true;
    const receipt = randomBytes(32).toString("hex");
    this.receipts.set(receipt, {
      requestId: id,
      hash,
      revision: this.config.revision,
      provider: "cloud",
      expiresAt: r.expiresAt,
    });
    this.audit({ event: "approved", route: "cloud", at: this.now() });
    return { receipt, expiresAt: r.expiresAt };
  }
  async local(id: string) {
    const r = this.request(id);
    this.requests.delete(id);
    return this.execute(r, false);
  }
  async cloud(receipt: string) {
    this.prune();
    const approval = this.receipts.get(receipt);
    this.receipts.delete(receipt);
    if (!approval) throw new GatewayError("receipt_missing_or_expired", 403);
    const r = this.request(approval.requestId);
    this.requests.delete(approval.requestId);
    if (
      !this.config.cloudEnabled ||
      !this.config.cloud ||
      !r.eligible ||
      approval.hash !== r.hash ||
      approval.revision !== this.config.revision ||
      approval.provider !== "cloud"
    )
      throw new GatewayError("cloud_forbidden", 403);
    return this.execute(r, true);
  }
  private async execute(r: Request, cloud: boolean) {
    try {
      const output = await this.provider(
        cloud ? this.config.cloud : this.config.local,
        cloud ? r.inspection.redacted : r.original,
      );
      const restoredCount = cloud
        ? [...r.inspection.mapping.keys()].filter((token) =>
            output.includes(token),
          ).length
        : 0;
      const final = cloud ? rehydrate(output, r.inspection.mapping) : output;
      this.audit({
        event: cloud ? "cloud_completed" : "local_completed",
        route: cloud ? "cloud" : "local",
        at: this.now(),
      });
      return {
        route: cloud ? "cloud" : "local",
        output: final,
        provider: cloud ? "cloud" : this.config.local ? "local" : "synthetic",
        restoredCount,
      };
    } catch {
      this.audit({
        event: "provider_failed",
        route: cloud ? "cloud" : "local",
        at: this.now(),
      });
      throw new GatewayError("provider_unavailable", 502);
    } finally {
      this.clearRequest(r);
    }
  }
}
