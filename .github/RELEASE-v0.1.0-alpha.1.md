# Privacy Handoff Gateway v0.1.0-alpha.1

**Pilot prerelease, not production certification. / 试用预发布，不代表生产安全认证。**

A local-first gateway with a Rust privacy scanner, TypeScript API and console, and optional Python client example. Unknown/confidential content stays local by default. Cloud egress is disabled by default and requires configured policy plus exact-payload approval.

本地优先网关，使用 Rust 隐私扫描核心、TypeScript API 与界面，并提供可选 Python 客户端示例。未知和机密内容默认留在本地。云端发送默认关闭，开启后仍须符合配置策略并确认具体发送内容。

## Personal use / 个人使用

The host launcher `npm run personal` offers bounded discovery of existing local Ollama/OpenAI-compatible models or a synthetic demo, with a fresh process-only token and cloud disabled. The browser includes a three-step onboarding guide. Read `docs/15-个人快速开始.md`; Docker discovery sees container localhost, not your host laptop. Real model inference remains a separate acceptance check.

个人启动器提供本机模型检测与合成演示选择，默认关闭云端、不保存凭据；具体安装与可选云配置见个人指南。

## Downloads / 下载

- `privacy-handoff-gateway-linux-amd64.tar.gz`: the exact Linux AMD64 container image that passed this release's CI. Load it with `gzip -dc privacy-handoff-gateway-linux-amd64.tar.gz | docker load`.
- `privacy-handoff-gateway-source.tar.gz`: source and documentation from the same commit.
- `manifest.json`: source commit, image ID, platform and tag. Verify the loaded image ID against this file.
- `SHA256SUMS`: run `sha256sum --check SHA256SUMS` with all assets in one directory. Checksums detect corruption; obtain them from a trusted release source.

镜像标签：`privacy-handoff-gateway:v0.1.0-alpha.1-linux-amd64`。离线设备需预先安装兼容的 Docker，并提前取得任何模型运行时、模型权重及其许可证。镜像不包含模型。

## Validation and limits / 验证与边界

Publication follows TypeScript lint/typecheck/tests/build, Rust tests/build, container smoke, browser smoke and a disconnected (`--network none`) **synthetic** runtime check. See the linked Actions run for this exact source commit. No live-model inference, customer acceptance test or independent penetration test is implied.

发布流程以类型检查、代码检查、合成测试、构建、容器与浏览器冒烟检查，以及断网合成运行检查为前提。断网检查不等于真实本地模型推理验证。不同 CPU 架构、操作系统、GPU 驱动和模型服务仍须单独验收。

The bundle is Linux AMD64 only. A connected preparation machine is needed to build/download dependencies and artifacts; the prepared runtime can be transferred to an offline environment. A real local model requires a separately prepared local inference service. Multi-user enterprise identity, three-tier networking, universal file handling and zero-leakage guarantees are not implemented claims.

## Start here / 开始使用

Extract the source archive and read `README.md`, `docs/README.md`, and `docs/14-离线安装与发布.md`. Configure a fresh token and a trusted local endpoint; keep cloud access disabled for offline usage. Treat the synthetic demo as a wiring test, not AI inference.

## Licensing / 许可

New gateway core and UI: Handoff Community 1.0, free for ordinary internal use; commercial resale/hosting/bundling requires separate written authorization. Documentation, specifications, standalone tests and examples: Apache-2.0. Historical Apache grants remain intact; dependencies retain their own licenses. Read `LICENSE-SCOPE.md`, `LICENSING.md` and `THIRD_PARTY_NOTICES.md` before distribution. The complete project is source-available, not wholly OSI open source.
