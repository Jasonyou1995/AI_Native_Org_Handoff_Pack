# Mac mini and MacBook Pro · Mac 本机安装与验收

**Use the native personal launcher first, beside your local model.** Mac mini and MacBook Pro are product names, not CPU architectures: either can be Apple Silicon or Intel. Use the matching native Node and Rust tools. The published `linux/amd64` Docker image is not a native macOS application or an Apple Silicon image.

**优先使用本机个人启动器，与本地模型在同一台 Mac 运行。** Mac mini、MacBook Pro 是产品名称，不代表处理器架构。按 Apple Silicon 或 Intel 选择原生 Node 与 Rust 工具。已发布的 `linux/amd64` Docker 镜像不是 macOS 原生应用，也不是 Apple Silicon 镜像。

## 1. Check the Mac · 检查机器

In Terminal, from the Mac you intend to use / 在目标 Mac 的终端执行：

```bash
sw_vers
uname -m
node -p 'process.platform + " " + process.arch'
rustc -vV
xcode-select -p
```

- Apple Silicon: use an ordinary native Terminal, Node `darwin arm64`, Rust host `aarch64-apple-darwin`. Do not mix a Rosetta terminal/x64 Node with an arm64 build tree.
- Intel: expect Node `darwin x64`, Rust host `x86_64-apple-darwin`.
- If a command is missing, install Node.js 24 from [Node.js](https://nodejs.org/en/download), Rust through [official rustup instructions](https://www.rust-lang.org/tools/install), and Apple's Command Line Tools when needed. `xcode-select --install` opens Apple's installer; complete it before building. No Homebrew requirement or enterprise account is needed.
- 当前 CI 选择 macOS 15 的 arm64 与 Intel 两种原生环境；更老或更新的 macOS、Safari 以及具体硬件仍需单独验收。CI 不等于已测试用户自己的两台 Mac。

Do not disable Gatekeeper, SIP, the browser sandbox or your firewall. This is a source-built command-line app serving a local browser page, not a signed/notarized `.app` installer.

不关闭 Gatekeeper、SIP、浏览器沙箱或防火墙。当前通过源码构建命令行服务与本机网页，不提供已签名/公证的 `.app` 安装器。

## 2. Build once · 首次构建

From a reviewed checkout, after the prerequisites are installed / 在审查后的源码目录执行：

```bash
npm ci --ignore-scripts
npm run rust:build
npm run typecheck
npm run lint
npm run test:all
npm run build
npm run personal -- --demo
```

CI pins Node 24.22.2 and Rust 1.99.1. For an exact Rust reproduction when rustup is already installed, run `rustup toolchain install 1.99.1 --profile minimal`, then prefix the build command with `RUSTUP_TOOLCHAIN=1.99.1`. Initial dependency/toolchain downloads require connectivity. Build each Mac's Rust binary natively; do not copy the Linux scanner, another architecture's `node_modules`, or an Intel build tree to Apple Silicon.

CI 固定 Node 24.22.2 与 Rust 1.99.1。首次下载依赖/工具链需要联网；每台 Mac 应使用对应架构重新构建。不要复制 Linux 扫描器、另一架构的 `node_modules` 或编译目录。升级 Node/Rust 后重新执行验收。

Open the localhost URL printed by the launcher, follow the welcome dialog, open **Settings**, enter its freshly generated connection code, then choose the synthetic demo. Enter a task, click **Next: check task**, review, then **Run locally**. The result must say synthetic/demo, not real AI inference. Keep the terminal open. Ctrl+C stops it and discards pending in-memory requests. The token is not a model API key; do not share it in screenshots.

打开启动器输出的本机网址，按欢迎弹窗进入设置，输入新生成的连接码，选择合成演示。写下任务，下一步检查、确认后本地处理。输出必须明确标为合成演示。保持终端开启，Ctrl+C 停止并丢弃内存中请求。令牌不是模型 API Key，不要发到截图或聊天中。

## 3. Use the existing local model · 使用已有本地模型

Start your already installed Ollama or compatible local service with downloaded model files. If the personal gateway is already running, leave it running and open Settings; otherwise:

启动已安装且已下载权重的本地模型服务。个人网关已运行时无需重启，直接打开设置；否则：

```bash
npm run personal
```

In browser **Settings**, connect and refresh local models. Select a model, then press **Use selected model**. The selection applies to this running personal session without restarting. Existing previews are invalidated. Ollama suggestions require completion-capable metadata; embedding-only or unknown-capability models are excluded. Up to the first 20 eligible candidates are checked within a bounded deadline. Discovery checks only Ollama `127.0.0.1:11434` and an OpenAI-compatible service at `127.0.0.1:1234`, without sending a prompt or scanning your network. Other ports/authenticated model lists need deliberate manual configuration in the [personal guide](15-个人快速开始.md). No model is installed or downloaded automatically. If a model is unavailable, the app reports it; reconnect to confirm configuration and inspect again, without automatic cloud fallback. The personal launcher always disables cloud.

在浏览器设置中连接、刷新并选择模型，点击“使用所选模型”。本次个人进程立即应用，无需重启；旧预览作废。只探测两个固定本机端口，不发送提示、不扫描内网、不自动安装或下载模型。其他端口须手动配置。模型不可用时应明确报错，不静默回退云端。个人启动器始终关闭云端。

A localhost service can still proxy elsewhere. Confirm the model is genuinely local, avoid cloud-backed aliases, and test with synthetic input before private data. The gateway has bounded provider timeouts; a cold/oversized model may fail. Choose a model suitable for the Mac's available RAM and warm it locally. No hardware-independent speed claim is made.

本机服务仍可能转发到外部。先确认真实本地推理，避免云代理模型，先用虚构输入。提供方超时有上限，冷启动或过大模型可能失败；按可用内存选模型并预热，不承诺跨硬件统一速度。

## 4. Accept each Mac separately · 两台 Mac 分别验收

Record only non-sensitive results: model of Mac, macOS version, architecture, toolchain versions, source revision and pass/fail. Never upload tokens, private prompts, device serial numbers or model responses containing personal data.

仅记录非敏感环境信息与通过/失败，不上传令牌、私密提示、序列号或含个人资料的输出。

| Check · 检查 | Mac mini | MacBook Pro |
|---|---|---|
| Native toolchain matches CPU · 工具链匹配架构 | Pending / 待验 | Pending / 待验 |
| Rust build + TypeScript tests · 原生构建与测试 | Pending / 待验 | Pending / 待验 |
| Browser demo, reset, repeat click · 演示、清空、重复点击 | Pending / 待验 | Pending / 待验 |
| Existing local-model discovery · 已有本地模型发现 | Pending / 待验 | Pending / 待验 |
| Real local synthetic task · 真实本地模型处理虚构任务 | Pending / 待验 | Pending / 待验 |
| Restart and disconnect Internet after preparation · 准备后断网重启 | Pending / 待验 | Pending / 待验 |

The [native macOS workflow](../.github/workflows/macos.yml) tests both architecture families on GitHub-hosted macOS 15 runners: Rust, TypeScript, a synthetic personal-launcher HTTP flow, and Chrome UI. A green run establishes only that commit and those runner environments. It does not certify these two physical Macs, Safari, real model inference, or every macOS version. Check the run results before calling either matrix entry passed.

[原生 Mac CI](../.github/workflows/macos.yml) 覆盖两个架构家族的 Rust、TypeScript、合成启动器 HTTP 与 Chrome UI；通过仅证明该提交及所测环境，不能代替具体两台 Mac、Safari、真实推理或全部 macOS 版本的验收。

## 5. Offline and troubleshooting · 离线与排障

Prepare the correct architecture's dependencies, compiled gateway and model files first. Thereafter `npm run personal -- --demo` needs no model or Internet; real inference needs the prepared local service. Disconnect only external connectivity while retaining localhost. Do not change OS security settings to make a test pass. See [offline deployment](14-离线安装与发布.md) for supply-chain and third-party model-license boundaries.

先准备匹配架构的依赖、编译产物和权重，再验证断网运行。保留 localhost，勿为测试降低操作系统安全。模型、Docker、工具链各自许可独立适用。

- **Port 3000 in use:** stop your earlier gateway terminal before starting another; do not kill unrelated processes.
- **Wrong architecture / executable failure:** verify `node -p process.arch`, `rustc -vV`, and rebuild on the target Mac. Do not silently switch scanners.
- **Ollama not detected inside Docker:** container localhost is not host localhost. Use this native launcher rather than exposing the model publicly.
- **Browser denied local access:** review the exact permission requested. Do not grant broad network/device access just to dismiss a warning.
- **Missing Chinese glyphs:** use the Mac's normal CJK-capable system fonts. The UI does not fetch remote webfonts.

Runner labels and software verified against [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [macOS 15 arm64 inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md), and [Intel inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md), 2026-11-03.
