# Local-first Privacy Gateway · 本地优先隐私网关

**Keep private know-how local while sharing only the authorized information needed for productive AI collaboration.**

**让私有经验与方法留在本地，只共享高效 AI 协作所必需且已获授权的信息。**

## One problem, shared work · 一个问题，共同建设

People, communities and organizations of any size should be able to work with AI without making unnecessary knowledge extraction the price of participation. We build the public interfaces, local-first controls and verifiable boundaries for that collaboration. Share an authorized result, not automatically the private knowledge that produced it. Privacy is a prerequisite; improve efficiency within that boundary, not by quietly removing it.

个人、社区及不同规模的组织，应能参与 AI 协作，而不必以交出不必要的知识为代价。我们共同建设公开接口、本地优先控制与可验证的边界。共享获准的成果，不等于自动交出产生它的私人知识。隐私是前提，效率应在这个边界内优化，而不是通过悄悄取消边界来提高。

Read the bilingual [mission and collaboration charter](docs/13-使命与协作宪章.md) for principles, governance and contribution paths. This is a design commitment, not a guarantee of employment, income, ownership or zero leakage.

原则、治理与参与路径见中英双语[使命与协作宪章](docs/13-使命与协作宪章.md)。这是设计承诺，不是就业、收入、权属或零泄漏保证。

## Status and license · 状态与许可

**Pilot software, not a security-certified production product.** The recorded checks passed 47 TypeScript tests and 10 Rust tests. Docker image build, synthetic image smoke and browser smoke passed for commit `7e605e5` in [GitHub CI](https://github.com/Jasonyou1995/AI_Native_Org_Handoff_Pack/actions/runs/41420786747). Offline-image export and disconnected-runtime checks are separate release gates. The employee-device → company → cloud architecture is **design only**; current code is a single-process local/cloud gateway. See the [verification record](docs/12-验证记录.md). These tests do not validate the historical agent-handoff lifecycle or coordination benchmark.

**这是试点软件，不是已获安全认证的生产产品。** 已记录的检查通过 47 项 TypeScript 测试与 10 项 Rust 测试。提交 `7e605e5` 的 Docker 镜像构建、合成镜像烟测与浏览器烟测已在 [GitHub CI](https://github.com/Jasonyou1995/AI_Native_Org_Handoff_Pack/actions/runs/41420786747) 通过。离线镜像导出与断网运行检查是另外的发布门槛。员工设备 → 企业 → 云端三层架构**仅为设计**；当前代码是单进程本地/云端网关。见[验证记录](docs/12-验证记录.md)。这些测试不代表历史 agent handoff 生命周期或协同成本基准已完成。

Public documentation, specifications, standalone tests and examples use Apache-2.0 under the [license scope](LICENSE-SCOPE.md). The new gateway core is **source-available, not OSI open source**: [Handoff Community 1.0](LICENSES/Handoff-Community-1.0.txt) permits free normal internal use by individuals, universities, companies and other organizations, including production, research and teaching. Commercializing the gateway itself requires a separate license. Existing Apache-2.0 rights remain intact.

按[许可范围](LICENSE-SCOPE.md)，公开文档、规范、独立测试及示例适用 Apache-2.0。新增网关核心是**源码可见（source-available），不是 OSI 开源软件**：[Handoff Community 1.0](LICENSES/Handoff-Community-1.0.txt) 允许个人、大学、企业和其他组织免费正常内部使用，包括生产、研究与教学。将网关本身商业化须另行授权。已有 Apache-2.0 权利不变。

## Inspect locally before cloud · 先在本地检查，再决定是否上云

Cloud calls are disabled by default. No API key or automatic model download is required. The browser shows detection results, a redacted preview and routing reasons. Only policy-eligible, individually approved requests go to an administrator-configured cloud endpoint. Detection can miss sensitive information; redaction is not anonymization.

默认关闭云调用，不需要 API key，也不自动下载模型。浏览器展示检测结果、脱敏预览与路由原因；只有符合策略且逐次批准的请求才会发送到管理员配置的云端。检测可能漏报，脱敏不等于匿名化。

TypeScript handles HTTP, policy, approval and UI; Rust is the default bounded text scanner. If Rust fails or is missing, processing is refused, not silently downgraded. Administrators may explicitly select the TypeScript scanner. The optional Python standard-library client is an integration example, not another server. Neither scanner detects every secret, and no Rust speed advantage is promised.

TypeScript 负责 HTTP、策略、批准与 UI；默认 Rust 核心负责有界文本扫描。Rust 缺失或失败时拒绝处理，不会静默降级；管理员可显式选择 TypeScript 扫描器。可选 Python 标准库客户端是集成示例，不是另一个服务端。两种检测器都不能发现所有秘密，也没有 Rust 提速承诺。

## First run · 第一次使用

**Mac mini / MacBook Pro:** start with the [native Mac installation and acceptance guide](docs/16-Mac本机安装与验收.md). Apple Silicon and Intel need matching native toolchains; the Linux AMD64 release image is not a native Mac application.

**Start here for personal use:** [one-minute guide and local model setup](docs/15-个人快速开始.md). On a prepared developer machine, `npm run personal` lets you choose a detected local model or a clearly labeled synthetic demo, with cloud disabled and a temporary token. Discovery checks two fixed localhost services, not every model installation.

**个人使用从这里开始：**[一分钟指南与本地模型设置](docs/15-个人快速开始.md)。在已完成构建的开发机器运行 `npm run personal`，选择检测到的本地模型或明确标记的合成演示；云端关闭，令牌仅用于本次进程。检测仅覆盖两个固定本机服务，不承诺发现任意模型安装。

[Documentation hub · 文档中心](docs/README.md) | [Offline installation and release · 离线安装与发布](docs/14-离线安装与发布.md)

Prepare Docker Engine or Docker Desktop, Docker Compose and Git. `make` is a convenience entrypoint; see the [deployment guide](docs/10-部署演练.md) for direct Compose commands and offline preparation. Host Node.js is not required. The first build needs access to image and dependency sources.

准备 Docker Engine 或 Docker Desktop、Docker Compose 和 Git。`make` 只是便捷入口；直接 Compose 命令与离线准备见[部署演练](docs/10-部署演练.md)。宿主机无需安装 Node.js。首次构建需要访问镜像与依赖源。

```bash
git clone https://github.com/Jasonyou1995/AI_Native_Org_Handoff_Pack.git
cd AI_Native_Org_Handoff_Pack
cp .env.example .env
# Edit .env: replace GATEWAY_TOKEN with a random token of at least 32 characters.
# Keep cloud calls disabled for the first run.
make run
```

Before starting, replace the example `GATEWAY_TOKEN` in `.env` with a random local gateway credential of at least 32 characters. If this revision is not yet upstream, use the supplied source package instead of assuming the clone includes it.

启动前编辑 `.env`，将示例 `GATEWAY_TOKEN` 替换为至少 32 字符的随机本机网关凭据。如果此次版本尚未发布到上游，请使用收到的源码包，不要假定克隆已包含它。

Open **http://127.0.0.1:3000**:

1. Enter your gateway credential if prompted. It is not a cloud API key.
2. Use `Summarize this note: contact alice@example.test.` with local-only mode and unknown classification.
3. Inspect detection, preview and the reason for staying local; then execute locally.
4. Without a model, the result is explicitly a synthetic demo, not model inference.
5. Configure a local model through the [integration guide](docs/07-本地隐私网关.md). Before cloud use, configure organizational policy and networking, then inspect, preview and approve each request. Do not test first installation with real customer data.

打开 **http://127.0.0.1:3000**：

1. 如有要求，输入网关凭据；它不是云模型 API key。
2. 使用 `Summarize this note: contact alice@example.test.`，保持“仅本地”和未知分类。
3. 查看检测、预览与留在本地的原因，然后执行本地处理。
4. 未接模型时明确显示“合成演示”，不是模型推理。
5. 按[接入指南](docs/07-本地隐私网关.md)配置本地模型。上云前先配置组织策略与网络，再逐次检查、预览、批准。不要用真实客户数据验证初次安装。

## Current boundaries · 当前边界

| Capability · 能力 | Boundary · 边界 |
|---|---|
| Local-first · 本地优先 | Unknown, confidential and local-only inputs stay local; local failure never falls back to cloud. 未知、机密与仅本地输入留在本地；本地失败不回退到云端。 |
| Detection · 检测 | Common patterns and organizational terms; optional local classification may only tighten routing. 常见格式与组织词表；可选本地分类模型只能收紧路由。 |
| Files · 文件 | UTF-8 `.txt`, `.md`, `.csv`, `.json`; UI 3 files, API 4; 32 KiB each, total wrapped text ≤64 KiB. UTF-8 文本；UI 最多 3 个、API 最多 4 个；每个 32 KiB，含包装总文本不超过 64 KiB。 |
| Approval · 批准 | Short-lived, single-use credential bound to a fixed redacted request; cannot prove the reviewer read it or has organizational authority. 对固定脱敏请求签发短期、单次凭据；不能证明人已阅读或具备组织权限。 |
| Restoration · 回填 | Only known placeholders for the current request; no guarantee of placeholder preservation or answer correctness. 仅回填本次已知占位符；不保证占位符保留或答案正确。 |
| Models · 模型 | OpenAI-compatible non-streaming text Chat Completions, not universal protocol/model support. OpenAI-compatible 非流式文本接口，不支持任意协议或模型。 |

No PDF, Word, images, OCR, archives or hidden-metadata cleanup. No bundled classifier training, fine-tuning, SSO, tenant isolation, centralized key management, tamper-proof audit or OS egress firewall.

不支持 PDF、Word、图片、OCR、压缩包或隐藏元数据清理。不包含分类模型训练、微调、内置 SSO、租户隔离、集中密钥管理、不可篡改审计或操作系统出网防火墙。

## Where data goes · 数据去哪里

Original prompts, text attachments, redaction mappings and approval state live temporarily in **gateway process memory**, with a 120-second lifetime and cleanup after consumption; restart loses them. This is not a persistent database or guaranteed immediate physical-memory erasure. Browser, proxy, model-service, swap and crash-dump retention need separate controls.

原始提示、文本附件、脱敏映射与批准状态暂存于**网关进程内存**，有效期 120 秒，消费后清理，重启丢失。这不是持久数据库，也不保证立即从物理内存抹除。浏览器、代理、模型服务、交换分区和崩溃转储的留存须另行治理。

Local models may receive originals: verify that you control them and they do not forward externally. Cloud models receive the approved redacted user text, fixed system prompt and model parameters; missed context may still identify people or businesses. The gateway does not perform your provider, cross-border, model-license or data-processing-agreement review.

本地模型可能收到原文：须确认受你控制且不向外转发。云模型接收获准的脱敏用户文本、固定系统提示和模型参数；漏检上下文仍可能识别人或业务。网关不替你完成供应商、跨境、模型许可或数据处理协议审查。

## Contribute and sustain · 参与与持续发展

We welcome individuals, community teams and large organizations around one problem. Contribute reusable interfaces, small independent adapters, synthetic test cases and documentation, not private customer data or proprietary methods. Maintainers remain accountable for review and security gates; boundary and license changes need a public RFC. Core contribution rights must be agreed explicitly before merging, with no forced copyright assignment. See the [charter](docs/13-使命与协作宪章.md) and [contribution policy](CONTRIBUTING.md).

欢迎个人、社区团队及大型组织围绕同一个问题合作。贡献可复用接口、小而独立的适配器、合成测试与文档，不提交私人客户资料或专有方法。维护者对审查与安全门槛负责；边界和许可变更须走公开 RFC。核心贡献须在合并前明确授权，不强迫转让版权。见[宪章](docs/13-使命与协作宪章.md)与[贡献政策](CONTRIBUTING.md)。

Creators can keep rights-controlled capabilities private and offer their own services through public interfaces. Optional paid integration, training and support may fund maintenance; compliant third-party services are welcome. Gateway resale, paid hosting or commercial bundling requires separate authorization. Ordinary internal use, normal university tuition and delivering ordinary work results do not trigger that requirement. No customers or revenue are guaranteed. See [commercial licensing and services](docs/商业授权.md).

创作者可保留其有权控制的私有能力，通过公开接口提供自己的服务。可选的付费集成、培训与支持可支持维护，也欢迎合规的第三方服务。转售网关、收费托管或商业捆绑须另行授权；正常内部使用、高校正常学费及交付普通工作成果不因此收费。不保证客户或收入。见[商业授权与服务](docs/商业授权.md)。

## Verify and read · 验证与阅读

```bash
make install
make test
make attacks
make verify
```

The three check commands cover unit tests, attack defenses and current privacy-gateway scenarios respectively, not the historical ten handoff scenarios. Report actual execution evidence, not assumed production readiness. Dependencies, model weights, Docker and cloud services retain their own terms.

三个检查命令分别覆盖单元测试、攻击防护和当前隐私网关场景，不是历史十项 handoff 场景。以实际执行证据为准，不据此推定生产就绪。第三方依赖、模型权重、Docker 与云服务保留各自条款。

- [Mission and collaboration charter · 使命与协作宪章](docs/13-使命与协作宪章.md)
- [Boundary-change RFC template · 边界变更提案模板](docs/RFC-TEMPLATE.md)
- [Contribution review template · 贡献审查模板](.github/PULL_REQUEST_TEMPLATE.md)
- [Python integration example · Python 集成示例](examples/python_client.py)
- [Configuration and API · 配置与 API](docs/07-本地隐私网关.md)
- [Production acceptance · 生产验收](docs/09-生产验收与运维.md)
- [Deployment and rollback · 部署与回滚](docs/10-部署演练.md)
- [Three-tier design · 三层设计](docs/11-员工与企业三层交接.md) / [English specification · 英文规范](spec/THREE-TIER-SHARING-SPEC.md)
- [Verification record · 验证记录](docs/12-验证记录.md)
- [Historical research boundaries · 历史研究边界](docs/00-总体规划.md)
