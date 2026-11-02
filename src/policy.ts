// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { randomBytes } from "node:crypto";
import { rustScannerStatus, scanWithRust } from "./rust-core.js";
export type Finding = { kind: string; count: number };
export type Inspection = {
  redacted: string;
  mapping: Map<string, string>;
  findings: Finding[];
  blocked: boolean;
};
export function scanWithTypeScript(text: string, terms: string[]) {
  const spans: { start: number; end: number; kind: string }[] = [];
  let blocked = /\[\[PG_[^\]]*\]\]/u.test(text);
  const detect = (kind: string, pattern: RegExp) => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (kind === "secret") blocked = true;
      if (spans.length >= 4096)
        throw new RangeError("Detection capacity exceeded");
      spans.push({ start, end, kind });
    }
  };
  detect(
    "secret",
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)|\b(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,}|\b(?:password|passwd|api[_ -]?key|secret|token)\s*[:=]\s*[^\s,;]+/giu,
  );
  for (const term of terms)
    detect(
      "organization",
      new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"),
    );
  detect(
    "email",
    /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Z0-9](?:[A-Z0-9.-]{0,252}[A-Z0-9])?\.[A-Z]{2,}/giu,
  );
  detect("identifier", /\b\d{17}[\dX]\b|\b\d{3}-\d{2}-\d{4}\b/giu);
  detect("phone", /(?<![\w])(?:\+?\d[\d ()-]{6,}\d)(?![\w])/gu);
  return { spans, blocked };
}
export function scannerStatus() {
  return process.env.PRIVACY_SCANNER === "typescript"
    ? { engine: "typescript", available: true }
    : rustScannerStatus();
}
export function inspectText(text: string, terms: string[]): Inspection {
  const mapping = new Map<string, string>();
  const counts = new Map<string, number>();
  const { spans, blocked } =
    process.env.PRIVACY_SCANNER === "typescript"
      ? scanWithTypeScript(text, terms)
      : scanWithRust(text, terms);
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof spans = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span.start < previous.end) {
      previous.end = Math.max(previous.end, span.end);
      if (span.kind === "secret") previous.kind = "secret";
    } else merged.push({ ...span });
  }
  let cursor = 0;
  let redacted = "";
  for (const span of merged) {
    const token = `[[PG_${randomBytes(24).toString("hex")}]]`;
    mapping.set(token, text.slice(span.start, span.end));
    counts.set(span.kind, (counts.get(span.kind) ?? 0) + 1);
    redacted += text.slice(cursor, span.start) + token;
    cursor = span.end;
  }
  redacted += text.slice(cursor);
  return {
    redacted,
    mapping,
    findings: [...counts].map(([kind, count]) => ({ kind, count })),
    blocked,
  };
}
export function rehydrate(text: string, mapping: Map<string, string>): string {
  let bytes = Buffer.byteLength(text);
  let substitutions = 0;
  for (const match of text.matchAll(/\[\[PG_[a-f0-9]{48}\]\]/g)) {
    const value = mapping.get(match[0]);
    if (value !== undefined) {
      bytes += Buffer.byteLength(value) - Buffer.byteLength(match[0]);
      if (++substitutions > 2048 || bytes > 131072)
        throw new RangeError("Restoration limit exceeded");
    }
  }
  if (bytes > 131072) throw new RangeError("Restoration limit exceeded");
  return text.replace(
    /\[\[PG_[a-f0-9]{48}\]\]/g,
    (token) => mapping.get(token) ?? token,
  );
}
