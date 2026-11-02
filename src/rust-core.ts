// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const spanSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    kind: z.enum(["secret", "organization", "email", "identifier", "phone"]),
  })
  .strict();
const responseSchema = z
  .object({
    version: z.literal(1),
    offsets: z.literal("utf16"),
    spans: z.array(spanSchema).max(4096),
    blocked: z.boolean(),
  })
  .strict();
export type ScanResult = {
  spans: z.infer<typeof spanSchema>[];
  blocked: boolean;
};

function binaryPath(): string {
  return resolve(
    process.env.PRIVACY_SCANNER_BIN ??
      "rust-core/target/release/privacy-scanner",
  );
}
export function rustScannerStatus(): { engine: "rust"; available: boolean } {
  try {
    accessSync(binaryPath(), constants.X_OK);
    return { engine: "rust", available: true };
  } catch {
    return { engine: "rust", available: false };
  }
}
function scannerError(): Error {
  return new Error(
    "Rust scanner unavailable or invalid response; run npm run rust:build or use Docker",
  );
}
function boundary(text: string, offset: number): boolean {
  if (offset === 0 || offset === text.length) return true;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return !(
    before >= 0xd800 &&
    before <= 0xdbff &&
    after >= 0xdc00 &&
    after <= 0xdfff
  );
}
export function scanWithRust(text: string, terms: string[]): ScanResult {
  if (
    !text.isWellFormed() ||
    Buffer.byteLength(text) > 65536 ||
    terms.length > 100 ||
    terms.some(
      (term) =>
        !term.isWellFormed() || term.length === 0 || [...term].length > 100,
    )
  ) {
    throw new RangeError("Detection input limit exceeded");
  }
  const child = spawnSync(binaryPath(), [], {
    input: JSON.stringify({ text, terms }),
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 524288,
    windowsHide: true,
    env: { LANG: "C.UTF-8" },
    shell: false,
  });
  if (child.error || child.status !== 0) {
    if (
      !child.error &&
      /^(SPAN_LIMIT|INPUT_LIMIT|TERM_LIMIT)\s*$/.test(child.stderr ?? "")
    ) {
      throw new RangeError("Detection capacity exceeded");
    }
    throw scannerError();
  }
  let result: z.infer<typeof responseSchema>;
  try {
    result = responseSchema.parse(JSON.parse(child.stdout));
  } catch {
    throw scannerError();
  }
  let previousEnd = 0;
  for (const span of result.spans) {
    if (
      span.start < previousEnd ||
      span.end <= span.start ||
      span.end > text.length ||
      !boundary(text, span.start) ||
      !boundary(text, span.end)
    )
      throw scannerError();
    previousEnd = span.end;
  }
  return { spans: result.spans, blocked: result.blocked };
}
