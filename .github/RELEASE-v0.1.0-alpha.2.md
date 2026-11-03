# Privacy Handoff Gateway v0.1.0-alpha.2

**Pilot prerelease, not production certification. / 试用预发布，不代表生产安全认证。**

A local-first gateway with a Rust privacy scanner, TypeScript API and console, and optional Python client example. Unknown/confidential content stays local by default. Cloud egress is disabled by default and requires configured policy plus exact-payload approval.

本地优先网关，使用 Rust 隐私扫描核心、TypeScript API 与界面，并提供可选 Python 客户端示例。未知和机密内容默认留在本地。云端发送默认关闭，开启后仍须符合配置策略并确认具体发送内容。

## Personal use / 个人使用

The host launcher `npm run personal` discovers supported existing local Ollama/OpenAI-compatible services or offers a synthetic demo. It uses a fresh process-only token and disables cloud access. Ollama discovery checks completion capability and excludes remote-only and embedding-only models. Discovery is bounded; a missing service or model is not automatically installed or downloaded.

个人启动器检测受支持的本机模型服务，也提供合成演示。云端默认关闭；模型服务与权重需要提前准备。演示用于检查流程，不代表真实 AI 推理。

The guided task, review and result screens, simplified settings, and revised onboarding are the intended redesign for this pilot. Their implementation and validation are pending integration; this draft does not yet claim those changes are shipped. Before publication, replace this paragraph with the verified behavior of the release commit.

本次计划把任务、检查和结果分开显示，将高级选项收进设置，并更新操作引导。以上界面改动仍待集成验证；发布前应以实际通过验证的版本更新此段说明。

Read `docs/15-个人快速开始.md`. Host model discovery runs on the computer hosting the gateway; discovery inside Docker sees container localhost, not the host laptop. A real local model must be tested separately from the synthetic demo.

## Downloads / 下载

- `privacy-handoff-gateway-linux-amd64.tar.gz`: the exact Linux AMD64 container image checked by this release's Linux CI. Load it with `gzip -dc privacy-handoff-gateway-linux-amd64.tar.gz | docker load`.
- `privacy-handoff-gateway-source.tar.gz`: source and documentation from the same commit.
- `manifest.json`: source commit, image ID, platform and tag. Verify the loaded image ID against this file.
- `RELEASE-NOTES.md`: these notes, included in the checksums.
- `SHA256SUMS`: run `sha256sum --check SHA256SUMS` with all assets in one directory. On macOS, use `shasum -a 256 -c SHA256SUMS`. Obtain both checksums and assets from a trusted release source.

镜像标签：`privacy-handoff-gateway:v0.1.0-alpha.2-linux-amd64`。此版本不覆盖 alpha.1。镜像只提供 Linux AMD64，不是 macOS 原生应用或 Apple Silicon 容器镜像，不包含模型、用户数据或凭据。

## Validation and limits / 验证与边界

Publication requires successful Linux gateway checks and both native macOS 15 architecture jobs (Apple Silicon arm64 and Intel x64) for the same source commit. The Mac jobs exercise the native Rust scanner, TypeScript checks, synthetic personal-launcher/authentication/replay smoke and Chrome browser smoke. Linux checks also cover the container image and a disconnected (`--network none`) **synthetic** runtime. Check the Actions run for the exact release commit.

发布必须通过同一提交的 Linux 检查及 Apple Silicon、Intel 两种原生 macOS 检查。Mac 检查包含本机扫描核心、合成个人启动流程与浏览器测试；Linux 另验证容器及断网合成运行。CI 架构测试不能代替每台实体 Mac mini 或 MacBook Pro 的验收。

These gates do not certify live-model inference, customer acceptance, independent security review or zero leakage. Hosted Mac CI does not demonstrate a physical MacBook Pro test. A connected preparation machine is needed to obtain dependencies, artifacts, model runtimes and weights; prepared local operation can then be tested offline with cloud access disabled. Downloads are not zero-configuration installers. Multi-user enterprise identity, three-tier networking and universal file handling are outside this pilot's claims.

真实推理、完全离线的本机模型、具体硬件与企业场景仍需单独验收。不要把合成测试视为生产安全认证。

## Start here / 开始使用

Extract the source and read `README.md`, `docs/README.md`, `docs/15-个人快速开始.md` and `docs/14-离线安装与发布.md`. For personal Mac use, follow the native source instructions. For the container bundle, prepare a compatible Docker runtime and a separately configured trusted local inference endpoint. Keep cloud access disabled for offline use.

## Licensing / 许可

New gateway core and UI: Handoff Community 1.0, free for ordinary internal use; commercial resale/hosting/bundling requires separate written authorization. Documentation, specifications, standalone tests and examples: Apache-2.0. Historical Apache grants remain intact; dependencies and model weights retain their own licenses. Read `LICENSE-SCOPE.md`, `LICENSING.md` and `THIRD_PARTY_NOTICES.md` before distribution. The complete project is source-available, not wholly OSI open source.

新网关核心与界面遵循 Handoff Community 1.0，普通内部使用免费；转售、托管或商业捆绑须另行取得书面授权。文档、规范、独立测试和示例遵循 Apache-2.0，历史授权不变。
