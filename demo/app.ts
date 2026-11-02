// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

export {};

interface GatewayStatus {
  mode: string;
  cloudEnabled: boolean;
  policyRevision: string;
  classifier?: string;
  scanner?: { engine: string; available: boolean };
  limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number };
}
interface Inspection {
  requestId: string;
  route: "local" | "approval_required";
  reasons: string[];
  findings: { kind: string; count: number }[];
  redactedPreview: string;
  payloadHash: string;
  expiresAt: string | number;
  policyRevision: string;
  provider: string;
  outboundPayload: Record<string, unknown> | null;
  destination: { url: string; model: string } | null;
}
interface ProcessingResult {
  route: string;
  output: string;
  provider: string;
  restoredCount: number;
}
interface InputFile {
  name: string;
  content: string;
}
function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element: ${id}`);
  return value as T;
}
const promptInput = element<HTMLTextAreaElement>("prompt");
const fileInput = element<HTMLInputElement>("files");
const tokenInput = element<HTMLInputElement>("runtime-token");
const classification = element<HTMLSelectElement>("classification");
const approval = element<HTMLInputElement>("approve-check");
const inspectButton = element<HTMLButtonElement>("inspect");
const localButton = element<HTMLButtonElement>("local-run");
const cloudButton = element<HTMLButtonElement>("cloud-send");
const fields = element<HTMLFieldSetElement>("task-fields");
let token = "";
let status: GatewayStatus | undefined;
let inspection: Inspection | undefined;
let files: InputFile[] = [];
let busy = false;
let version = 0;
let expirationTimer: ReturnType<typeof setTimeout> | undefined;
const encoder = new TextEncoder();
const labels: Record<string, string> = {
  email: "电子邮箱",
  phone: "电话号码",
  secret: "凭据或密钥",
  api_key: "API 凭据",
  private_key: "私钥",
  id_number: "身份标识",
  credit_card: "银行卡号",
  ip_address: "IP 地址",
  credential: "凭据",
  organization_term: "组织敏感词",
  organization: "组织敏感词",
  identifier: "身份标识",
  phone_number: "电话号码",
};
const reasonLabels: Record<string, string> = {
  local_only_selected: "已选择仅本地处理。",
  confidential_stays_local: "机密分类不允许外发。",
  unknown_stays_local: "未知分类保守留在本地。",
  cloud_disabled: "管理员尚未开启云端路径。",
  secret_or_reserved_placeholder: "发现凭据或保留占位符，禁止外发。",
  redaction_residual: "脱敏后仍发现风险，禁止外发。",
  explicit_approval_required: "仅在你逐次批准后才允许外发。",
  detection_is_not_proof_of_safety: "规则检测不等于无泄漏保证。",
  local_classifier_veto_or_failure: "本地分类器否决或不可用，保守留在本地。",
  classifier_advisory_review_only:
    "本地分类器仅提供辅助判断，不能扩大外发权限。",
};
function notify(message: string, error = false): void {
  const notice = element("notice");
  notice.textContent = message;
  notice.classList.toggle("error", error);
}
function progress(step: string): void {
  for (const name of ["input", "inspect", "review", "result"]) {
    element(`step-${name}`).classList.toggle("active", name === step);
  }
}
function invalidate(message?: string): void {
  version += 1;
  inspection = undefined;
  clearTimeout(expirationTimer);
  approval.checked = false;
  cloudButton.disabled = true;
  localButton.hidden = true;
  element("approval-box").hidden = true;
  element("review-details").hidden = true;
  element("preview").textContent = "尚未生成。不会自动发起云端请求。";
  element("findings").replaceChildren();
  element("reasons").replaceChildren();
  element("route-badge").textContent = "需要重新检测";
  element("review-summary").textContent =
    "检查仅适用于当前输入。修改内容、文件、分类或模式后，旧审批立即失效。";
  element("result").textContent = "你的结果将显示在这里。";
  element("result-badge").textContent = "尚未运行";
  element("result-info").textContent =
    "结果回到本地后显示。演示输出会明确标记，不冒充真实模型回答。";
  progress("input");
  if (message) notify(message);
}
function setBusy(value: boolean): void {
  busy = value;
  fields.disabled = value;
  tokenInput.disabled = value;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#connection-form button, #example, #reset",
  ))
    button.disabled = value;
  inspectButton.disabled = value || !status;
  localButton.disabled = value;
  approval.disabled = value;
  cloudButton.disabled = value || !approval.checked || !inspection;
  element("workspace").setAttribute("aria-busy", String(value));
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const detail =
      isObject(data) && typeof data.error === "string"
        ? data.error
        : `HTTP ${response.status}`;
    throw new Error(
      `网关拒绝或未完成请求：${detail}。请检查连接或重新检测，不会自动重试外发。`,
    );
  }
  return data;
}
function parseStatus(data: unknown): GatewayStatus {
  if (
    !isObject(data) ||
    typeof data.mode !== "string" ||
    typeof data.cloudEnabled !== "boolean" ||
    typeof data.policyRevision !== "string" ||
    !isObject(data.limits)
  )
    throw new Error("网关状态格式不符合预期。");
  if (
    data.scanner !== undefined &&
    (!isObject(data.scanner) ||
      !["rust", "typescript"].includes(String(data.scanner.engine)) ||
      typeof data.scanner.available !== "boolean")
  )
    throw new Error("网关扫描引擎状态无效。");
  const limits = data.limits;
  for (const key of ["maxFiles", "maxFileBytes", "maxTotalBytes"]) {
    if (
      typeof limits[key] !== "number" ||
      !Number.isSafeInteger(limits[key]) ||
      limits[key] <= 0
    )
      throw new Error("网关输入限制无效。");
  }
  return data as unknown as GatewayStatus;
}
function parseInspection(data: unknown): Inspection {
  if (
    !isObject(data) ||
    !["local", "approval_required"].includes(String(data.route)) ||
    !Array.isArray(data.reasons) ||
    !data.reasons.every((item: unknown) => typeof item === "string") ||
    !Array.isArray(data.findings) ||
    !data.findings.every(
      (item: unknown) =>
        isObject(item) &&
        typeof item.kind === "string" &&
        typeof item.count === "number",
    )
  )
    throw new Error("检测响应格式不符合预期。");
  for (const key of [
    "requestId",
    "redactedPreview",
    "payloadHash",
    "policyRevision",
    "provider",
  ])
    if (typeof data[key] !== "string")
      throw new Error("检测响应缺少必要字段。");
  if (
    (typeof data.expiresAt !== "number" &&
      typeof data.expiresAt !== "string") ||
    !Number.isFinite(new Date(data.expiresAt).getTime())
  )
    throw new Error("检测有效期无效。");
  if (data.outboundPayload !== null && !isObject(data.outboundPayload))
    throw new Error("检测响应缺少完整外发载荷。");
  if (data.route === "approval_required" && data.outboundPayload === null)
    throw new Error("没有完整外发载荷，不能申请批准。");
  if (
    data.destination !== null &&
    (!isObject(data.destination) ||
      typeof data.destination.url !== "string" ||
      typeof data.destination.model !== "string")
  )
    throw new Error("检测响应缺少有效目的地。");
  if (data.route === "approval_required" && data.destination === null)
    throw new Error("没有外发目的地，不能申请批准。");
  return data as unknown as Inspection;
}
function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "操作未完成。请重新检查本地网关。";
}
function renderInspection(value: Inspection): void {
  element("preview").textContent = value.outboundPayload
    ? JSON.stringify(value.outboundPayload, null, 2)
    : `云端未配置，不存在可发送的云端请求。\n\n以下仅为脱敏内容：\n${value.redactedPreview}`;
  element("route-badge").textContent =
    value.route === "local" ? "仅本地路径" : "等待人工批准";
  element("review-summary").textContent =
    value.route === "local"
      ? "此任务不会通过此流程发送至云端。你仍可审阅检测结果，再执行本地处理。"
      : "尚未外发。请审阅完整预览，确认后才能单次发送。规则脱敏可能遗漏敏感信息。";
  const findingNodes = value.findings.map((finding) => {
    const badge = document.createElement("span");
    badge.className = "finding";
    badge.textContent = `${labels[finding.kind] ?? finding.kind} · ${finding.count}`;
    return badge;
  });
  element("findings").replaceChildren(...findingNodes);
  element("reasons").replaceChildren(
    ...value.reasons.map((reason) => {
      const item = document.createElement("li");
      item.textContent = reasonLabels[reason] ?? reason;
      return item;
    }),
  );
  element("review-details").hidden = false;
  element("payload-hash").textContent = value.payloadHash;
  element("expiry").textContent = new Date(value.expiresAt).toLocaleString();
  element("provider").textContent = value.destination
    ? `${value.destination.url} · ${value.destination.model}`
    : `${value.provider}（无云端目的地）`;
  localButton.hidden = false;
  const mode = document.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  )?.value;
  const canApprove =
    value.route === "approval_required" &&
    mode === "hybrid" &&
    classification.value === "public" &&
    status?.cloudEnabled === true;
  element("approval-box").hidden = !canApprove;
  progress(canApprove ? "review" : "inspect");
  const remaining = new Date(value.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    invalidate("预览已过期，请重新检测。");
    return;
  }
  expirationTimer = setTimeout(
    () => invalidate("预览已过期，旧批准已清除。请重新检测。"),
    Math.min(remaining, 2147483647),
  );
  notify(
    canApprove
      ? "检测完成，尚未外发。请审阅并决定是否批准。"
      : "检测完成。此时尚未执行模型任务，你可以继续本地处理。",
  );
}
function showResult(data: unknown): void {
  if (
    !isObject(data) ||
    typeof data.output !== "string" ||
    typeof data.provider !== "string" ||
    typeof data.route !== "string" ||
    typeof data.restoredCount !== "number"
  )
    throw new Error("处理结果格式不符合预期。");
  const result = data as unknown as ProcessingResult;
  element("result").textContent = result.output;
  element("result-badge").textContent =
    result.provider === "synthetic"
      ? "虚构演示输出"
      : result.route === "local"
        ? "本地处理"
        : "云端返回";
  element("result-info").textContent =
    `${result.provider === "synthetic" ? "内置确定性演示，不是真实模型回答。" : `提供方：${result.provider}。`}本地还原 ${result.restoredCount} 处占位符。请人工核对结果。`;
  progress("result");
  element("result-title").scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "nearest",
  });
  notify("处理完成。结果只显示在当前页面，请在离开前清空工作区。");
}
element<HTMLFormElement>("connection-form").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    if (busy) return;
    invalidate();
    status = undefined;
    token = tokenInput.value.trim();
    tokenInput.value = "";
    setBusy(true);
    notify("正在读取本地网关配置…");
    try {
      status = parseStatus(await request("/api/status"));
      element("connection-badge").textContent = "本地网关已连接";
      element("connection-badge").classList.add("good");
      element("cloud-config").textContent = status.cloudEnabled
        ? "已启用，仍需逐次审批"
        : "已关闭";
      element("policy-config").textContent = status.policyRevision;
      element("mode-config").textContent =
        status.mode === "synthetic"
          ? "虚构演示，无真实模型"
          : "已配置本地提供方";
      element("classifier-config").textContent =
        status.classifier === "local_advisory"
          ? "本地辅助，可否决外发"
          : "未启用，仅规则检测";
      element("scanner-config").textContent = status.scanner
        ? `${status.scanner.engine === "rust" ? "Rust 核心" : "TypeScript 显式兼容模式"} · ${status.scanner.available ? "可用" : "不可用，检测将被阻止"}`
        : "服务端未报告";
      notify("已连接。默认仅本地处理；切换混合路径不会自动外发。");
    } catch (error) {
      token = "";
      element("connection-badge").textContent = "连接失败";
      element("connection-badge").classList.remove("good");
      for (const id of [
        "cloud-config",
        "policy-config",
        "mode-config",
        "classifier-config",
        "scanner-config",
      ])
        element(id).textContent = "未读取";
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  },
);
promptInput.addEventListener("input", () => {
  element("char-count").textContent = `${promptInput.value.length} / 16000`;
  invalidate();
});
classification.addEventListener("change", () => invalidate());
for (const radio of document.querySelectorAll<HTMLInputElement>(
  'input[name="mode"]',
))
  radio.addEventListener("change", () => invalidate());
fileInput.addEventListener("change", async () => {
  if (busy) return;
  invalidate();
  files = [];
  element("file-list").replaceChildren();
  setBusy(true);
  const selected = Array.from(fileInput.files ?? []);
  const selectionVersion = version;
  const maxFiles = Math.min(status?.limits.maxFiles ?? 4, 4);
  try {
    if (selected.length > maxFiles)
      throw new Error(`最多选择 ${maxFiles} 个文件。`);
    const next: InputFile[] = [];
    for (const file of selected) {
      if (!/\.(txt|md|csv|json)$/i.test(file.name))
        throw new Error(
          "仅支持 .txt、.md、.csv、.json，不会将其他文件当作纯文本读取。",
        );
      if (file.size > Math.min(status?.limits.maxFileBytes ?? 32768, 32768))
        throw new Error("文件超过 32 KB 或网关限制。");
      const content = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (
        Array.from(content).some((char) => {
          const code = char.charCodeAt(0);
          return code < 32 && ![9, 10, 13].includes(code);
        })
      )
        throw new Error("文件包含二进制控制字符，请提供 UTF-8 文本。");
      next.push({ name: file.name, content });
    }
    if (selectionVersion !== version) return;
    files = next;
    element("file-list").replaceChildren(
      ...files.map((file) => {
        const item = document.createElement("li");
        item.textContent = `${file.name} · ${encoder.encode(file.content).length} 字节`;
        return item;
      }),
    );
    notify("文件已在页面内存中读取。点击检测后才会发送至本地网关。");
  } catch (error) {
    if (selectionVersion !== version) return;
    files = [];
    fileInput.value = "";
    notify(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
});
element<HTMLFormElement>("task-form").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    if (busy || !status) return;
    invalidate();
    if (!promptInput.value.trim()) {
      notify("请先输入任务。", true);
      return;
    }
    const bytes =
      encoder.encode(promptInput.value).length +
      files.reduce(
        (total, file) =>
          total +
          encoder.encode(file.content).length +
          encoder.encode(file.name).length,
        0,
      );
    if (bytes > Math.min(status.limits.maxTotalBytes, 65536)) {
      notify("输入总量超过 64 KB 或网关限制，请缩短内容。", true);
      return;
    }
    const currentVersion = version;
    setBusy(true);
    notify("正在本地检测与准备预览，尚未外发…");
    progress("inspect");
    try {
      const data = await request("/api/inspect", {
        prompt: promptInput.value,
        classification: classification.value,
        mode:
          document.querySelector<HTMLInputElement>('input[name="mode"]:checked')
            ?.value ?? "local_only",
        files,
      });
      if (version !== currentVersion) return;
      inspection = parseInspection(data);
      renderInspection(inspection);
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  },
);
approval.addEventListener("change", () => {
  cloudButton.disabled = !approval.checked || !inspection || busy;
});
async function processTask(cloud: boolean): Promise<void> {
  const current = inspection;
  if (busy || !current || (cloud && !approval.checked)) return;
  if (new Date(current.expiresAt).getTime() <= Date.now()) {
    invalidate("预览已过期，请重新检测。");
    return;
  }
  const currentVersion = version;
  setBusy(true);
  clearTimeout(expirationTimer);
  notify(
    cloud ? "正在批准当前载荷并发送，不会自动重试…" : "正在调用本地处理路径…",
  );
  try {
    let data: unknown;
    if (cloud) {
      const approved = await request("/api/approve", {
        requestId: current.requestId,
        payloadHash: current.payloadHash,
      });
      if (!isObject(approved) || typeof approved.receipt !== "string")
        throw new Error("审批响应格式无效，未发起云端调用。");
      if (currentVersion !== version)
        throw new Error("输入已经变化，未发起云端调用。");
      data = await request("/api/cloud", { receipt: approved.receipt });
    } else {
      data = await request("/api/local", { requestId: current.requestId });
    }
    if (currentVersion === version) showResult(data);
  } catch (error) {
    notify(
      `${errorMessage(error)}${cloud ? " 若已开始云端调用，响应失败不代表没有发送。" : ""}`,
      true,
    );
  } finally {
    inspection = undefined;
    approval.checked = false;
    element("route-badge").textContent = "预览已消费";
    element("approval-box").hidden = true;
    localButton.hidden = true;
    setBusy(false);
  }
}
localButton.addEventListener("click", () => {
  void processTask(false);
});
cloudButton.addEventListener("click", () => {
  void processTask(true);
});
element("example").addEventListener("click", () => {
  invalidate("已填入完全虚构的示例。分类仍为未知，默认仅本地。");
  promptInput.value =
    "以下为完全虚构的演示数据，不对应真实个人。\n请总结会议记录并列出下一步行动：\nAlice 的测试邮箱是 alice@example.test。Bob 将在周五前完成示例文档。请保留联系人以便本地还原演示。";
  classification.value = "unknown";
  const localMode = document.querySelector<HTMLInputElement>(
    'input[value="local_only"]',
  );
  if (localMode) localMode.checked = true;
  files = [];
  fileInput.value = "";
  element("file-list").replaceChildren();
  element("char-count").textContent = `${promptInput.value.length} / 16000`;
});
element("reset").addEventListener("click", () => {
  invalidate(
    "工作区已清空，运行令牌也已从页面内存移除。服务端请求按其有效期清理。",
  );
  promptInput.value = "";
  files = [];
  fileInput.value = "";
  token = "";
  tokenInput.value = "";
  status = undefined;
  classification.value = "unknown";
  const localMode = document.querySelector<HTMLInputElement>(
    'input[value="local_only"]',
  );
  if (localMode) localMode.checked = true;
  element("file-list").replaceChildren();
  element("char-count").textContent = "0 / 16000";
  element("connection-badge").textContent = "尚未连接";
  element("connection-badge").classList.remove("good");
  for (const id of [
    "cloud-config",
    "policy-config",
    "mode-config",
    "classifier-config",
    "scanner-config",
  ])
    element(id).textContent = "未读取";
  inspectButton.disabled = true;
  tokenInput.focus();
});
