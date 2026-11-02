// Copyright 2026 Jason You
// SPDX-License-Identifier: Apache-2.0
// See LICENSE and LICENSE-SCOPE.md.

import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const artifacts = resolve(
  process.env.BROWSER_ARTIFACTS ?? `${root}/artifacts/browser-smoke`,
);
const profile = await mkdtemp(`${tmpdir()}/handoff-browser-`);
const token = "synthetic-browser-test-not-a-real-credential";
const origin = "http://127.0.0.1:3187";
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
const processes: ChildProcess[] = [];
const failures: string[] = [];
let socket: WebSocket | undefined;
let cleanupStarted = false;

async function cleanup(): Promise<void> {
  if (cleanupStarted) return;
  cleanupStarted = true;
  socket?.close();
  await Promise.all(
    processes.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await Promise.race([
        new Promise<void>((done) => child.once("exit", () => done())),
        pause(1500),
      ]);
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }),
  );
  await rm(profile, { recursive: true, force: true });
}
const deadline = setTimeout(() => {
  console.error("Browser smoke exceeded the 120-second deadline");
  void cleanup().finally(() => process.exit(1));
}, 120_000);
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });
}
function launch(
  command: string,
  args: string[],
  env = process.env,
): ChildProcess {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.on("error", (error) => failures.push(error.message));
  child.stderr?.on("data", (data: Buffer) =>
    failures.push(data.toString().slice(0, 2048)),
  );
  processes.push(child);
  return child;
}
function record(value: unknown): Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    "Expected CDP object",
  );
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  assert.equal(typeof value, "string", "Expected CDP string");
  return value as string;
}
try {
  await mkdir(artifacts, { recursive: true });
  // Never inherit provider configuration or use a real model in this test.
  launch(process.execPath, ["dist/src/server.js"], {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: "3187",
    GATEWAY_TOKEN: token,
    PRIVACY_SCANNER: "rust",
    PRIVACY_SCANNER_BIN:
      process.env.PRIVACY_SCANNER_BIN ??
      resolve(root, "rust-core/target/release/privacy-scanner"),
    CLOUD_ENABLED: "false",
    LOCAL_URL: undefined,
    LOCAL_API_KEY: undefined,
    CLOUD_URL: undefined,
    CLOUD_API_KEY: undefined,
    CLASSIFIER_MODEL: undefined,
    ORG_TERMS: undefined,
  });
  // Keep Chromium's sandbox enabled. Run on an ordinary non-root CI account.
  launch(process.env.CHROME_BIN ?? "google-chrome", [
    "--headless",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ]);
  let port = "";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      port =
        (await readFile(`${profile}/DevToolsActivePort`, "utf8")).split(
          "\n",
        )[0] ?? "";
    } catch {
      /* Wait for Chromium startup. */
    }
    if (port) break;
    await pause(100);
  }
  assert(/^\d+$/.test(port), `Chromium did not start: ${failures.join("\n")}`);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* Wait for the server. */
    }
    if (ready) break;
    await pause(100);
  }
  assert(ready, `Server did not start: ${failures.join("\n")}`);
  const info = record(
    await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(),
  );
  const connection = new WebSocket(string(info.webSocketDebuggerUrl));
  socket = connection;
  await new Promise<void>((done, reject) => {
    connection.addEventListener("open", () => done(), { once: true });
    connection.addEventListener(
      "error",
      () => reject(new Error("CDP connection failed")),
      { once: true },
    );
  });
  type Pending = {
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const pending = new Map<number, Pending>();
  const events: { method: string; params: Record<string, unknown> }[] = [];
  let sequence = 0;
  connection.addEventListener("message", (event) => {
    const data = record(JSON.parse(String(event.data)));
    if (typeof data.id === "number") {
      const item = pending.get(data.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(data.id);
      if (data.error) item.reject(new Error(JSON.stringify(data.error)));
      else item.resolve(record(data.result ?? {}));
    } else if (typeof data.method === "string") {
      events.push({ method: data.method, params: record(data.params ?? {}) });
    }
  });
  connection.addEventListener("close", () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("CDP disconnected"));
    }
    pending.clear();
  });
  function cdp(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolveResult, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timed out: ${method}`));
      }, 10_000);
      pending.set(id, { resolve: resolveResult, reject, timer });
      connection.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  }
  const targetId = string(
    (await cdp("Target.createTarget", { url: "about:blank" })).targetId,
  );
  const sessionId = string(
    (await cdp("Target.attachToTarget", { targetId, flatten: true })).sessionId,
  );
  const send = (method: string, params: Record<string, unknown> = {}) =>
    cdp(method, params, sessionId);
  async function evaluate(expression: string): Promise<unknown> {
    const response = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert(
      !response.exceptionDetails,
      JSON.stringify(response.exceptionDetails),
    );
    return record(response.result).value;
  }
  async function wait(expression: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await pause(80);
    }
    throw new Error(
      `UI wait failed: ${expression}; notice=${await evaluate('document.querySelector("#notice")?.textContent')}`,
    );
  }
  const click = (selector: string) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill = (selector: string, value: string) =>
    evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  async function screenshot(name: string): Promise<void> {
    const result = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(
      `${artifacts}/${name}.png`,
      Buffer.from(string(result.data), "base64"),
    );
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: origin });
  await wait('document.querySelector("#inspect") !== null');
  assert.equal(
    await evaluate('document.querySelector("#inspect").disabled'),
    true,
  );
  await fill("#runtime-token", "wrong");
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "连接失败"',
  );
  await fill("#runtime-token", token);
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "本地网关已连接"',
  );
  assert.equal(
    await evaluate('document.querySelector("#scanner-config").textContent'),
    "Rust 核心 · 可用",
  );
  await click("#example");
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  assert.equal(
    await evaluate('document.querySelector("#approval-box").hidden'),
    true,
  );
  await evaluate(
    'document.querySelector("#local-run").click();document.querySelector("#local-run").click()',
  );
  await wait(
    'document.querySelector("#result-badge").textContent === "虚构演示输出"',
  );
  const localRequests = events.filter(
    (event) =>
      event.method === "Network.requestWillBeSent" &&
      String(record(event.params.request).url).endsWith("/api/local"),
  );
  assert.equal(
    localRequests.length,
    1,
    "Double-click must issue only one local request",
  );
  assert.equal(
    await evaluate(
      'document.querySelector("#result").textContent.includes("alice@example.test")',
    ),
    true,
  );
  await screenshot("desktop-local-result");
  await fill(
    "#prompt",
    '<img src=x onerror="window.unsafeExecuted=true"> 虚构示例 alice@example.test',
  );
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  await click("#local-run");
  await wait(
    'document.querySelector("#result-badge").textContent === "虚构演示输出"',
  );
  assert.equal(await evaluate("Boolean(window.unsafeExecuted)"), false);
  assert.equal(await evaluate('document.querySelector("#result img")'), null);
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  await fill("#prompt", "已修改的虚构示例");
  assert.equal(
    await evaluate(
      'document.querySelector("#local-run").hidden && document.querySelector("#approval-box").hidden',
    ),
    true,
  );
  await evaluate(
    `(()=>{const dt=new DataTransfer();dt.items.add(new File(['fake'],'document.pdf',{type:'application/pdf'}));const el=document.querySelector('#files');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await wait(
    'document.querySelector("#notice").textContent.includes("仅支持")',
  );
  assert.equal(
    await evaluate('document.querySelector("#files").files.length'),
    0,
  );
  await evaluate(
    `(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array([255,254])],'invalid.txt'));const el=document.querySelector('#files');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
  await wait(
    'document.querySelector("#notice").classList.contains("error") && !document.querySelector("#task-fields").disabled',
  );
  assert.equal(
    await evaluate('document.querySelector("#files").files.length'),
    0,
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await screenshot("mobile-workspace");
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    true,
    "Mobile layout must not overflow horizontally",
  );
  assert.equal(
    await evaluate("localStorage.length + sessionStorage.length"),
    0,
  );
  await click("#reset");
  assert.equal(await evaluate('document.querySelector("#prompt").value'), "");
  assert.equal(
    await evaluate('document.querySelector("#inspect").disabled'),
    true,
  );
  assert.equal(
    events.filter((event) => event.method === "Runtime.exceptionThrown").length,
    0,
    "No uncaught browser exceptions",
  );
  assert.equal(
    events.filter(
      (event) =>
        event.method === "Network.requestWillBeSent" &&
        /\/api\/(approve|cloud)$/.test(
          String(record(event.params.request).url),
        ),
    ).length,
    0,
    "Local flow must never request cloud approval or execution",
  );
  const results = {
    passed: [
      "real Rust/synthetic local API",
      "wrong/right token",
      "single request on double-click",
      "HTML rendered as text",
      "edit invalidates preview",
      "unsupported file",
      "invalid UTF-8",
      "390px layout",
      "empty browser storage",
      "reset",
    ],
    screenshots: ["desktop-local-result.png", "mobile-workspace.png"],
  };
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  await writeFile(
    `${artifacts}/failure.txt`,
    `${String(error)}\n${failures.slice(-15).join("\n")}`,
  );
  throw error;
} finally {
  clearTimeout(deadline);
  await cleanup();
}
