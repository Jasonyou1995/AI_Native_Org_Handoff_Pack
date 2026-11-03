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
  // Chromium subprocesses can finish profile writes just after the parent exits.
  // Retry bounded transient directory races; persistent cleanup errors still fail CI.
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
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
  // Shared CI runners can take longer than 10 seconds to launch sandboxed Chrome.
  for (let attempt = 0; attempt < 300; attempt += 1) {
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
  // Metadata/model changes and cloud execution are fixtures. Local task flow uses Rust.
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const originalFetch = window.fetch.bind(window);
      window.discoveryFixture = {scope:"gateway_loopback",requiresRestart:false,configuredLocal:null,providers:[{id:"ollama",label:"Ollama",status:"available",url:"http://127.0.0.1:11434/v1/chat/completions",models:["synthetic-model:tiny"]}]};
      window.discoveryDelay = 0; window.selectionDelay = 0; window.localDelay = 0;
      window.discoveryCalls = 0; window.selectionCalls = 0; window.cloudCalls = 0;
      window.selectedModel = false; window.cloudFixture = false;
      window.fetch = async (input, options) => {
        if (input === "/api/status") {
          const response = await originalFetch(input, options);
          if (!response.ok) return response;
          const status = await response.json();
          status.setup = {runtimeSelection:true,configuredLocal:window.selectedModel ? {url:"http://127.0.0.1:11434/v1/chat/completions",model:"synthetic-model:tiny"}:null};
          if (window.selectedModel) status.mode = "local_provider";
          if (window.cloudFixture) status.cloudEnabled = true;
          return Response.json(status);
        }
        if (input === "/api/setup/discover") {
          window.discoveryCalls += 1;
          const body = JSON.stringify(window.discoveryFixture);
          await new Promise(resolve => setTimeout(resolve, window.discoveryDelay));
          return new Response(body, {status:200,headers:{"Content-Type":"application/json"}});
        }
        if (input === "/api/setup/select") {
          window.selectionCalls += 1; window.selectionBody = JSON.parse(options.body);
          await new Promise(resolve => setTimeout(resolve, window.selectionDelay));
          window.selectedModel = true;
          return Response.json({mode:"local_provider",configuredLocal:{url:"http://127.0.0.1:11434/v1/chat/completions",model:"synthetic-model:tiny"},cloudEnabled:false});
        }
        if (window.cloudFixture && input === "/api/inspect") return Response.json({requestId:"a".repeat(48),route:"approval_required",reasons:["explicit_approval_required"],findings:[],redactedPreview:"Public synthetic note",payloadHash:"b".repeat(64),expiresAt:Date.now()+120000,policyRevision:"fixture",provider:"cloud",outboundPayload:{model:"synthetic-cloud",messages:[{role:"system",content:"Full fixture instruction"},{role:"user",content:"Public synthetic note"}]},destination:{url:"https://example.invalid/v1/chat/completions",model:"synthetic-cloud"}});
        if (window.cloudFixture && input === "/api/approve") return Response.json({receipt:"c".repeat(64)});
        if (window.cloudFixture && input === "/api/cloud") { window.cloudCalls += 1; return Response.json({route:"cloud",provider:"cloud",output:"Synthetic cloud fixture result",restoredCount:0}); }
        const response = await originalFetch(input, options);
        if (input === "/api/local") await new Promise(resolve => setTimeout(resolve, window.localDelay));
        return response;
      };
    })();`,
  });
  await send("Page.navigate", { url: origin });
  // Navigation can resolve before the document and module script are ready.
  await wait('document.querySelector("#help-dialog")?.open === true');
  await click("#help-next");
  assert.equal(
    await evaluate('document.querySelector("#help-count").textContent'),
    "2 / 3",
  );
  await click("#help-back");
  assert.equal(
    await evaluate('document.querySelector("#help-count").textContent'),
    "1 / 3",
  );
  // Native Tab and Shift+Tab stay in the modal.
  await evaluate('document.querySelector("#help-next").focus()');
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  assert.equal(
    await evaluate('document.activeElement.hasAttribute("data-close")'),
    true,
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    modifiers: 8,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
    modifiers: 8,
  });
  assert.equal(await evaluate("document.activeElement.id"), "help-next");
  await click("#help-dialog [data-close]");
  await click("#help-open");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await wait('!document.querySelector("#help-dialog").open');
  await wait('document.activeElement.id === "help-open"');
  await click("#settings-open");
  await fill("#runtime-token", "wrong");
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "连接失败"',
  );
  assert.equal(
    await evaluate('document.querySelector("#inspect").disabled'),
    true,
  );
  await fill("#runtime-token", token);
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "本地网关已连接"',
  );
  await wait('!document.querySelector("#model-config-panel").hidden');
  assert.equal(
    await evaluate('document.querySelector("#runtime-token").value'),
    "",
  );
  assert.equal(
    await evaluate('document.querySelector("#scanner-config").textContent'),
    "rust · 可用",
  );
  await evaluate(
    'window.discoveryFixture.providers[0].models = ["bad\\nCLOUD_ENABLED=true"]',
  );
  await click("#detect-models");
  await wait(
    'document.querySelector("#discovery-status").textContent.includes("列表无效")',
  );
  assert.equal(
    await evaluate('document.querySelector("#model-config-panel").hidden'),
    true,
  );
  await evaluate(
    'window.discoveryFixture.providers[0].models = []; window.discoveryFixture.providers[0].status = "empty"',
  );
  await click("#detect-models");
  await wait(
    'document.querySelector("#discovery-status").textContent.includes("没有检测到")',
  );
  await click("#start-demo");
  assert.equal(
    await evaluate('document.querySelector("#settings-dialog").open'),
    false,
  );
  await click("#inspect");
  await wait('!document.querySelector("#review-screen").hidden');
  assert.equal(
    await evaluate(
      'document.querySelector("#input-screen").hidden && document.querySelector("#result-screen").hidden',
    ),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("#approval-box").hidden'),
    true,
  );
  await click("#review-back");
  assert.equal(
    await evaluate('document.querySelector("#local-run").hidden'),
    true,
  );
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  await evaluate(
    'document.querySelector("#local-run").click();document.querySelector("#local-run").click()',
  );
  await wait(
    'document.querySelector("#result-badge").textContent === "虚构演示输出"',
  );
  assert.equal(
    events.filter(
      (event) =>
        event.method === "Network.requestWillBeSent" &&
        String(record(event.params.request).url).endsWith("/api/local"),
    ).length,
    1,
  );
  await screenshot("desktop-local-result");
  await click("#new-task");
  await fill(
    "#prompt",
    '<img src=x onerror="window.unsafeExecuted=true"> synthetic alice@example.test',
  );
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  await click("#local-run");
  await wait(
    'document.querySelector("#result-badge").textContent === "虚构演示输出"',
  );
  assert.equal(await evaluate("Boolean(window.unsafeExecuted)"), false);
  assert.equal(await evaluate('document.querySelector("#result img")'), null);
  await click("#new-task");
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
  await fill("#prompt", "Synthetic delayed task");
  await click("#inspect");
  await wait('!document.querySelector("#local-run").hidden');
  await evaluate("window.localDelay = 350");
  await click("#local-run");
  await click("#reset");
  await pause(500);
  assert.equal(
    await evaluate(
      'document.querySelector("#result-screen").hidden && document.querySelector("#prompt").value === "" && document.querySelector("#inspect").disabled',
    ),
    true,
  );
  await click("#settings-open");
  await fill("#runtime-token", token);
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "本地网关已连接"',
  );
  await wait('!document.querySelector("#detect-models").disabled');
  await evaluate(
    'window.discoveryFixture.providers[0].models = ["synthetic-model:tiny"]; window.discoveryFixture.providers[0].status = "available"',
  );
  await click("#detect-models");
  await wait('!document.querySelector("#model-config-panel").hidden');
  await click("#use-model");
  await wait('!document.querySelector("#settings-dialog").open');
  assert.deepEqual(await evaluate("window.selectionBody"), {
    providerId: "ollama",
    model: "synthetic-model:tiny",
  });
  assert.equal(
    await evaluate('document.querySelector("#setup-mode").textContent'),
    "本地模型",
  );
  // Selection response arriving after reset must not reconnect or repopulate UI.
  await click("#settings-open");
  await evaluate("window.selectionDelay = 350");
  await click("#use-model");
  await click("#settings-dialog [data-close]");
  await click("#reset");
  await pause(500);
  assert.equal(
    await evaluate('document.querySelector("#inspect").disabled'),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("#connection-badge").textContent'),
    "尚未连接",
  );
  await click("#settings-open");
  await fill("#runtime-token", token);
  await click("#connection-form button");
  await wait('!document.querySelector("#detect-models").disabled');
  await evaluate("window.discoveryDelay = 350");
  await click("#detect-models");
  await click("#settings-dialog [data-close]");
  await click("#reset");
  await pause(500);
  assert.equal(
    await evaluate('document.querySelector("#model-services").children.length'),
    0,
  );
  // Cloud stays fully mocked, and requires visible recipient/full payload + explicit consent.
  await evaluate("window.cloudFixture = true; window.discoveryDelay = 0");
  await click("#settings-open");
  await fill("#runtime-token", token);
  await click("#connection-form button");
  await wait(
    'document.querySelector("#connection-badge").textContent === "本地网关已连接"',
  );
  await evaluate(
    'document.querySelector("#classification").value="public";document.querySelector("input[value=hybrid]").checked=true',
  );
  await click("#settings-dialog [data-close]");
  await fill("#prompt", "Public synthetic note");
  await click("#inspect");
  await wait('!document.querySelector("#approval-box").hidden');
  assert.equal(
    await evaluate('document.querySelector("#cloud-review").hidden'),
    false,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("#provider").textContent.includes("https://example.invalid/v1/chat/completions")',
    ),
    true,
  );
  assert.equal(
    await evaluate(
      'document.querySelector("#preview").textContent.includes("Full fixture instruction")',
    ),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("#cloud-send").disabled'),
    true,
  );
  assert.equal(await evaluate("window.cloudCalls"), 0);
  await screenshot("cloud-review-fixture");
  await click("#approve-check");
  await click("#cloud-send");
  await wait(
    'document.querySelector("#result-badge").textContent === "云端返回"',
  );
  assert.equal(await evaluate("window.cloudCalls"), 1);
  await click("#new-task");
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
  );
  await click("#help-open");
  await screenshot("mobile-help");
  await click("#help-dialog [data-close]");
  assert.equal(
    await evaluate("localStorage.length + sessionStorage.length"),
    0,
  );
  await click("#reset");
  assert.equal(
    events.filter((event) => event.method === "Runtime.exceptionThrown").length,
    0,
  );
  assert.equal(
    events.filter(
      (event) =>
        event.method === "Network.requestWillBeSent" &&
        !String(record(event.params.request).url).startsWith(origin),
    ).length,
    0,
    "No external browser requests",
  );
  await send("Page.reload");
  await wait('document.querySelector("#help-dialog")?.open === true');
  assert.equal(
    await evaluate('document.querySelector("#inspect").disabled'),
    true,
  );
  assert.equal(
    await evaluate('document.querySelector("#connection-badge").textContent'),
    "尚未连接",
  );
  const results = {
    passed: [
      "native Rust synthetic API",
      "wrong/right authentication and reconnect",
      "guided next/back/close/Escape and return focus",
      "one stage visible",
      "local review/back invalidation",
      "duplicate submit",
      "safe HTML rendering",
      "invalid extension/UTF-8",
      "runtime model selection contract",
      "reset during local processing",
      "reset during model selection",
      "reset during discovery",
      "full cloud recipient/payload review and explicit approval (mock only)",
      "390px layout",
      "empty browser storage",
      "no external browser requests",
    ],
    screenshots: [
      "desktop-local-result.png",
      "mobile-workspace.png",
      "mobile-help.png",
      "cloud-review-fixture.png",
    ],
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
