// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

import { performance } from "node:perf_hooks";
import { inspectText, scannerStatus } from "./policy.js";

const payload = "Synthetic alice@example.test 13800138000 幻想公司. ".repeat(
  100,
);
const samples: number[] = [];
for (let i = 0; i < 100; i++) {
  const start = performance.now();
  inspectText(payload, ["幻想公司"]);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    kind: "synthetic_deterministic_inspection_only",
    scanner: scannerStatus(),
    includesSubprocessStartup: scannerStatus().engine === "rust",
    runs: samples.length,
    inputBytes: Buffer.byteLength(payload),
    p50Ms: samples[49],
    p95Ms: samples[94],
    node: process.version,
    externalCalls: 0,
    notMeasured: ["model latency", "privacy recall", "production throughput"],
  }),
);
