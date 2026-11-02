# Documentation hub · 文档中心

One path from a synthetic demo to a controlled local deployment. This versioned documentation is the project's wiki source of truth; it travels with the source archive and can be read without a website. It is not a claim that GitHub's separate Wiki service has been published.

从合成演示到受控本地部署，按下面的顺序即可。这里是项目的版本化知识库，随源码包一起分发，无须联网访问网站；不代表已发布 GitHub 独立 Wiki。

## Start here · 从这里开始

| Goal · 目标 | Read · 阅读 | Exit condition · 完成标准 |
|---|---|---|
| Start as one person · 一个人先用起来 | [Personal quick start / 个人快速开始](15-个人快速开始.md) | Complete a synthetic task, then deliberately connect a local model · 完成合成任务，再明确接入本地模型 |
| Understand the product · 了解产品 | [README](../README.md), [mission / 使命](13-使命与协作宪章.md) | Explain the one problem and current limits · 能说清问题与边界 |
| Try without a model or cloud key · 无模型、无云 key 体验 | [Deployment tutorial / 部署演练](10-部署演练.md), sections A–B | A synthetic request succeeds locally · 合成请求在本地成功 |
| Connect your own model · 接入自有模型 | [Configuration and API / 配置与 API](07-本地隐私网关.md) | Actual model answers; shutdown fails without cloud fallback · 真模型回答，停机不会回退上云 |
| Deploy without Internet access · 无互联网部署 | [Offline installation / 离线安装](14-离线安装与发布.md) | Same verified image loads and runs with denied external egress · 同一已验证镜像在禁外网条件下运行 |
| Integrate an application · 集成应用 | [Gateway specification](../spec/PRIVACY-GATEWAY-SPEC.md), [Python client](../examples/python_client.py) | Synthetic API flow and replay rejection verified · 验证合成 API 流程及重放拒绝 |
| Decide on company rollout · 决定企业上线 | [Acceptance and operations / 验收与运维](09-生产验收与运维.md), [actual evidence / 实际证据](12-验证记录.md) | Named owners sign off each applicable gate · 负责人逐项验收 |
| Contribute · 参与贡献 | [Contributing](../CONTRIBUTING.md), [RFC template](RFC-TEMPLATE.md) | Small reviewed change with tests and clear rights · 小步审查、测试、权利清晰 |
| Understand commercial use · 理解商业使用 | [License scope / 许可范围](../LICENSE-SCOPE.md), [commercial model / 商业模式](商业授权.md) | Internal use versus selling gateway functionality distinguished · 区分内部使用与网关商业化 |

## Scope and support · 范围与支持

- Supported inputs: bounded UTF-8 text, Markdown, CSV and JSON. No PDF, Office, OCR, images or archives. Model integration is non-streaming OpenAI-compatible text Chat Completions, not every model protocol.
- 输入仅限有界 UTF-8 文本、Markdown、CSV、JSON；不支持 PDF、Office、OCR、图片或压缩包。模型接口为非流式 OpenAI-compatible 文本 Chat Completions，不代表所有协议兼容。
- The [three-tier design](11-员工与企业三层交接.md) is a future specification, not a deployed employee-device network. The original coordination-benchmark plans remain [historical research](00-总体规划.md).
- [三层设计](11-员工与企业三层交接.md) 是后续规范，不是已部署员工设备网络；旧协同基准计划属于[历史研究](00-总体规划.md)。
- Report ordinary problems through repository issues with version, OS, architecture, expected behavior and synthetic reproduction. Do not attach tokens, real files, prompts, model output or raw private logs. Report security concerns privately using [contribution security contact](../CONTRIBUTING.md).
- 普通问题通过仓库 issue 提交版本、系统、架构、预期行为与合成复现；不要附凭据、真实文件、提示、模型输出或原始私人日志。安全问题按[贡献指南的安全联系方式](../CONTRIBUTING.md)私下报告。

## Share responsibly · 负责任地传播

Demonstrate a synthetic local-only task and show the verification record with the exact revision. Link directly to installation and licensing. State unsupported cases. Do not advertise zero leakage, universal compliance, job protection or benchmark numbers not measured on that release. Useful examples and reproducible bug reports are better evidence than promises of popularity.

用合成本地任务演示，并展示对应版本的验证记录；直接链接安装与许可，说明不支持的情况。不宣传零泄漏、普遍合规、就业保障或未经该版本测量的性能。实用示例与可复现问题，比流行度承诺更有价值。
