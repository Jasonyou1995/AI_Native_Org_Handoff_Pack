// Copyright 2026 Jason You
// SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
// See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.

export {};

interface GatewayStatus {
  setup?: {
    runtimeSelection: boolean;
    configuredLocal: { url: string; model: string } | null;
  };
  mode: string;
  cloudEnabled: boolean;
  policyRevision: string;
  classifier?: string;
  scanner?: { engine: string; available: boolean };
  limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number };
}
interface DiscoveredProvider {
  id: "ollama" | "openai_compatible";
  label: string;
  status: "available" | "empty" | "unavailable" | "invalid_response";
  url: string;
  models: string[];
}
interface Discovery {
  scope: "gateway_loopback";
  requiresRestart: boolean;
  configuredLocal: { url: string; model: string } | null;
  providers: DiscoveredProvider[];
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
const detectButton = element<HTMLButtonElement>("detect-models");
const demoButton = element<HTMLButtonElement>("start-demo");
const modelSelect = element<HTMLSelectElement>("local-model");
let discoveryBusy = false;
let connectionVersion = 0;
let modelChoices: { providerId: string; model: string }[] = [];
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
  notice.setAttribute("role", error ? "alert" : "status");
  element("settings-notice").textContent = error ? message : "";
}
type Stage = "input" | "review" | "result";
function progress(step: string, focus = false): void {
  const stage: Stage =
    step === "result" ? "result" : step === "input" ? "input" : "review";
  for (const name of ["input", "review", "result"]) {
    element(`${name}-screen`).hidden = name !== stage;
    element(`step-${name}`).classList.toggle("active", name === stage);
    if (name === stage)
      element(`step-${name}`).setAttribute("aria-current", "step");
    else element(`step-${name}`).removeAttribute("aria-current");
  }
  if (focus) element(`${stage}-title`).focus();
}
const dialogs = [
  element<HTMLDialogElement>("settings-dialog"),
  element<HTMLDialogElement>("help-dialog"),
];
let returnFocus: HTMLElement | null = null;
function openDialog(id: string, opener?: HTMLElement): void {
  returnFocus =
    opener ??
    (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
  const dialog = element<HTMLDialogElement>(id);
  dialog.showModal();
  (dialog.querySelector<HTMLElement>("button, input") ?? dialog).focus();
}
for (const dialog of dialogs) {
  dialog
    .querySelector("[data-close]")
    ?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    if (!dialogs.some((item) => item.open) && returnFocus?.isConnected)
      returnFocus.focus();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex='0']",
      ),
    ].filter((el) => el.getClientRects().length > 0);
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
}
element("settings-open").addEventListener("click", () =>
  openDialog("settings-dialog", element("settings-open")),
);
const helpSteps = [
  [
    "先连接，再开始。",
    "打开设置，粘贴启动终端里的本地连接码。无需企业账户，也不要填写云端 API Key。",
  ],
  [
    "选择你的本地助手。",
    "在设置里选择这台电脑已经运行的模型。没有模型也能试用合成演示，但它不是真实 AI 回答。不会自动下载模型。",
  ],
  [
    "一个任务，三个步骤。",
    "写下任务，检查处理路径，再运行并查看结果。默认留在本地。只有明确允许且逐次审阅批准的内容才能交给云端。",
  ],
];
let helpStep = 0;
function renderHelp(): void {
  element("help-title").textContent = helpSteps[helpStep]?.[0] ?? "";
  element("help-body").textContent = helpSteps[helpStep]?.[1] ?? "";
  element("help-count").textContent = `${helpStep + 1} / 3`;
  element<HTMLButtonElement>("help-back").disabled = helpStep === 0;
  element("help-next").textContent = helpStep === 2 ? "开始使用" : "下一步";
}
element("help-open").addEventListener("click", () => {
  helpStep = 0;
  renderHelp();
  openDialog("help-dialog", element("help-open"));
});
element("help-back").addEventListener("click", () => {
  helpStep = Math.max(0, helpStep - 1);
  renderHelp();
  element("help-title").focus();
});
element("help-next").addEventListener("click", () => {
  if (helpStep === 2) {
    element<HTMLDialogElement>("help-dialog").close();
    if (!status) openDialog("settings-dialog");
    return;
  }
  helpStep += 1;
  renderHelp();
  element("help-title").focus();
});
function invalidate(message?: string): void {
  version += 1;
  inspection = undefined;
  clearTimeout(expirationTimer);
  approval.checked = false;
  cloudButton.disabled = true;
  localButton.hidden = true;
  element("approval-box").hidden = true;
  element("review-details").hidden = true;
  element("cloud-review").hidden = true;
  element("preview").textContent = "尚未生成。不会自动发起云端请求。";
  for (const id of ["redacted-preview", "payload-hash", "provider", "expiry"])
    element(id).textContent = "";
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
    "#connection-form button, #example, #use-model",
  ))
    button.disabled = value;
  inspectButton.disabled = value || !status;
  element<HTMLButtonElement>("use-model").disabled =
    value || !status?.setup?.runtimeSelection || !modelChoices.length;
  demoButton.disabled = value || !status;
  detectButton.disabled = value || !status || discoveryBusy || !token;
  localButton.disabled = value;
  approval.disabled = value;
  cloudButton.disabled = value || !approval.checked || !inspection;
  element("workspace").setAttribute("aria-busy", String(value));
  element<HTMLButtonElement>("settings-open").disabled = value;
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
    const messages: Record<string, string> = {
      unauthorized: "连接码不正确或已失效，请重新连接。",
      runtime_selection_disabled:
        "此服务器不允许页面切换模型。请使用个人启动器。",
      model_unavailable: "所选模型已不可用，请刷新列表并重新选择。",
      selection_superseded: "模型选择已改变，请重新连接确认，再检查任务。",
      session_changed: "处理环境已改变，请重新连接并检查任务。",
      provider_unavailable:
        "模型未完成回答。请检查本地服务或选择较小的模型，再重新检查任务。",
      request_not_found: "此预览已失效，请返回重新检查任务。",
      rate_limited: "请求过于频繁，请稍后再试。",
    };
    throw new Error(
      messages[detail] ??
        "网关未完成请求。请重新连接或检查任务，不会自动重试或改用云端。",
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
  if (
    data.setup !== undefined &&
    (!isObject(data.setup) || typeof data.setup.runtimeSelection !== "boolean")
  )
    throw new Error("网关设置状态无效。");
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
function clearSetup(): void {
  connectionVersion += 1;
  modelChoices = [];
  modelSelect.replaceChildren();
  element("model-services").replaceChildren();
  element("model-config-panel").hidden = true;

  element("setup-mode").textContent = "先连接网关";
  element("setup-summary").textContent =
    "连接后可以试用合成演示，或检查已经启动的本地模型。";
  element("discovery-status").textContent =
    "只检查网关所在环境的两个固定本机端口，不扫描你的局域网。";
  discoveryBusy = false;
  detectButton.disabled = true;
  demoButton.disabled = true;
}
function parseDiscovery(data: unknown): Discovery {
  if (
    !isObject(data) ||
    data.scope !== "gateway_loopback" ||
    typeof data.requiresRestart !== "boolean" ||
    !Array.isArray(data.providers) ||
    data.providers.length > 2
  )
    throw new Error("本地模型检测响应格式无效。");
  for (const value of data.providers) {
    if (
      !isObject(value) ||
      !["ollama", "openai_compatible"].includes(String(value.id)) ||
      typeof value.label !== "string" ||
      !["available", "empty", "unavailable", "invalid_response"].includes(
        String(value.status),
      ) ||
      ![
        "http://127.0.0.1:11434/v1/chat/completions",
        "http://127.0.0.1:1234/v1/chat/completions",
      ].includes(String(value.url)) ||
      !Array.isArray(value.models) ||
      value.models.length > 100 ||
      !value.models.every(
        (model: unknown) =>
          typeof model === "string" &&
          /^[A-Za-z0-9._:/@+-]{1,200}$/.test(model),
      )
    )
      throw new Error("本地模型列表无效，未生成配置。");
  }
  return data as unknown as Discovery;
}
async function discoverModels(): Promise<void> {
  if (!status || !token || discoveryBusy) return;
  const currentConnection = connectionVersion;
  discoveryBusy = true;
  detectButton.disabled = true;
  element("discovery-status").textContent =
    "正在检查两个固定本机服务，没有发送任务内容…";
  try {
    const data = parseDiscovery(await request("/api/setup/discover"));
    if (currentConnection !== connectionVersion) return;
    const serviceLabels = {
      available: "已发现本地候选模型",
      empty: "服务响应正常，但尚无可用模型",
      unavailable: "未响应或不可达",
      invalid_response: "响应不兼容，未使用",
    };
    element("model-services").replaceChildren(
      ...data.providers.map((provider) => {
        const item = document.createElement("li");
        item.textContent = `${provider.label} · ${serviceLabels[provider.status]} · ${provider.models.length} 个模型`;
        return item;
      }),
    );
    modelChoices = data.providers.flatMap((provider) =>
      provider.status === "available"
        ? provider.models.map((model) => ({ providerId: provider.id, model }))
        : [],
    );
    modelSelect.replaceChildren(
      ...modelChoices.map((choice, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${choice.model} · ${choice.providerId === "ollama" ? "Ollama" : "OpenAI compatible"}`;
        return option;
      }),
    );
    element("model-config-panel").hidden = modelChoices.length === 0;
    element<HTMLButtonElement>("use-model").disabled =
      busy || !status?.setup?.runtimeSelection || !modelChoices.length;
    element("discovery-status").textContent = modelChoices.length
      ? `发现 ${modelChoices.length} 个候选模型。选择模型后点击“使用所选模型”。检测不代表已完成推理验证。`
      : "没有检测到可用模型。请启动已有本地模型服务，再刷新；也可继续使用合成演示。";
  } catch (error) {
    if (currentConnection !== connectionVersion) return;
    modelChoices = [];
    modelSelect.replaceChildren();
    element("model-services").replaceChildren();
    element("model-config-panel").hidden = true;

    element("discovery-status").textContent =
      `${errorMessage(error)} 仍可使用已经配置的处理路径。`;
  } finally {
    if (currentConnection === connectionVersion) {
      discoveryBusy = false;
      detectButton.disabled = busy || !status || !token;
    }
  }
}
detectButton.addEventListener("click", () => {
  void discoverModels();
});
element("use-model").addEventListener("click", async () => {
  const choice = modelChoices[Number(modelSelect.value)];
  if (!choice || busy || !status?.setup?.runtimeSelection) return;
  invalidate();
  const generation = version;
  setBusy(true);
  notify("正在切换本地模型…");
  try {
    const selected = await request("/api/setup/select", choice);
    if (generation !== version) return;
    if (
      !isObject(selected) ||
      selected.mode !== "local_provider" ||
      selected.cloudEnabled !== false ||
      !isObject(selected.configuredLocal)
    )
      throw new Error("模型切换响应无效，请重新连接确认。");
    const nextStatus = parseStatus(await request("/api/status"));
    if (generation !== version) return;
    status = nextStatus;
    renderStatus();
    notify("本地模型已就绪。请先用虚构任务验证回答。");
    element<HTMLDialogElement>("settings-dialog").close();
    progress("input", true);
  } catch (error) {
    if (generation !== version) return;
    // A lost selection response can still mean server configuration changed.
    status = undefined;
    token = "";
    clearSetup();
    element("connection-badge").textContent = "请重新连接";
    notify(`${errorMessage(error)} 请重新连接确认模型，再重新检查任务。`, true);
  } finally {
    if (generation === version) setBusy(false);
  }
});
demoButton.addEventListener("click", () => {
  if (busy || !status) return;
  if (status.mode !== "synthetic") {
    notify(
      "当前已连接真实模型。要使用合成演示，请重新启动个人网关，默认即为演示模式。",
      true,
    );
    return;
  }
  element("example").click();
  element<HTMLDialogElement>("settings-dialog").close();
  inspectButton.focus();
  inspectButton.scrollIntoView({ block: "nearest" });
});
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
  element("redacted-preview").textContent = value.redactedPreview;
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
  element("cloud-review").hidden = !canApprove;
  localButton.classList.toggle("primary", !canApprove);
  progress("review", true);
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
  progress("result", true);
  element("result-title").scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "nearest",
  });
  notify("处理完成。结果只显示在当前页面，请在离开前清空工作区。");
}
function renderStatus(): void {
  if (!status) return;
  element("connection-badge").textContent = "本地网关已连接";
  element("cloud-config").textContent = status.cloudEnabled
    ? "已启用，仍须逐次批准"
    : "已关闭";
  element("policy-config").textContent = status.policyRevision;
  element("mode-config").textContent =
    status.mode === "synthetic" ? "合成演示，不是真实 AI" : "本地模型";
  element("setup-mode").textContent =
    status.mode === "synthetic" ? "合成演示 · 不是 AI 回答" : "本地模型";
  element("scanner-config").textContent = status.scanner
    ? `${status.scanner.engine} · ${status.scanner.available ? "可用" : "不可用，处理被阻止"}`
    : "未报告";
  element("classifier-config").textContent =
    status.classifier === "local_advisory" ? "本地辅助" : "未启用";
  element("setup-summary").textContent =
    status.mode === "synthetic"
      ? "当前是合成演示。你可以试用流程，或选择已有本地模型获得真实回答。"
      : "当前已配置本地模型。先用虚构任务验证真实推理。";
  if (status.setup?.configuredLocal)
    element("setup-summary").textContent =
      `当前本地模型：${status.setup.configuredLocal.model}。先用虚构任务验证回答。`;
  element("selection-help").textContent = status.setup?.runtimeSelection
    ? "选择仅用于当前进程，不保存到磁盘。云端保持关闭。"
    : "此服务器由运行方配置。浏览器不能切换模型；个人使用请启动 npm run personal。";
  demoButton.hidden = status.mode !== "synthetic";
}
element<HTMLFormElement>("connection-form").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    if (busy) return;
    invalidate();
    clearSetup();
    status = undefined;
    token = tokenInput.value.trim();
    tokenInput.value = "";
    const generation = version;
    setBusy(true);
    notify("正在连接…");
    try {
      const next = parseStatus(await request("/api/status"));
      if (generation !== version) return;
      status = next;
      renderStatus();
      notify("已连接。先选择一个本地模型，或试用合成演示。");
    } catch (error) {
      if (generation !== version) return;
      token = "";
      element("connection-badge").textContent = "连接失败";
      notify(errorMessage(error), true);
    } finally {
      if (generation === version) setBusy(false);
    }
    if (generation === version && status && token) void discoverModels();
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
    if (selectionVersion === version) setBusy(false);
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
      if (version === currentVersion) notify(errorMessage(error), true);
    } finally {
      if (version === currentVersion) setBusy(false);
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
    if (currentVersion !== version) return;
    notify(
      `${errorMessage(error)}${cloud ? " 若已开始云端调用，响应失败不代表没有发送。" : ""}`,
      true,
    );
  } finally {
    if (currentVersion === version) {
      inspection = undefined;
      approval.checked = false;
      element("route-badge").textContent = "预览已消费";
      element("approval-box").hidden = true;
      localButton.hidden = true;
      setBusy(false);
    }
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
  clearSetup();
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
  setBusy(false);
  progress("input", true);
});

element("review-back").addEventListener("click", () => {
  invalidate("内容可继续修改，运行前需要重新检查。");
  setBusy(false);
  progress("input", true);
});
element("new-task").addEventListener("click", () => {
  invalidate("写下一个新任务。默认仅本地处理。");
  classification.value = "unknown";
  const localMode = document.querySelector<HTMLInputElement>(
    'input[value="local_only"]',
  );
  if (localMode) localMode.checked = true;
  promptInput.value = "";
  files = [];
  fileInput.value = "";
  element("file-list").replaceChildren();
  element("char-count").textContent = "0 / 16000";
  progress("input", true);
});
// No history payloads or browser storage. Reload always requires reconnecting.
openDialog("help-dialog");
