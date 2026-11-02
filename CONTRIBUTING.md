# 贡献指南 / Contributing

欢迎个人、社区与公司一起解决一个问题：在保护隐私的前提下提高 AI 协作效率。先读 `AGENTS.md`、`LICENSE-SCOPE.md` 与相关规范。

Individuals, communities, and companies are welcome to solve one problem together: improving AI collaboration efficiency while protecting privacy. Read `AGENTS.md`, `LICENSE-SCOPE.md`, and the relevant specification first.

## 最容易开始的地方 / Easy places to start

文档、规范、`tests/**` 和 `examples/**` 采用 Apache-2.0。欢迎改进说明、翻译、合成测试、可复现问题与公开 API 集成示例。按 Apache-2.0 提交这些贡献即可，无须额外 CLA 或版权转让；其贡献及专利条款仍适用。

Documentation, specifications, `tests/**`, and `examples/**` use Apache-2.0. Improve explanations, translations, synthetic tests, reproducible reports, and public API examples. Contributions to these areas are under Apache-2.0 without a separate CLA or copyright assignment; its contribution and patent provisions apply.

## 核心贡献 / Core contributions

`src/**`、`rust-core/**`、`demo/**` 及列明配置保持社区许可，不因开放测试或示例而改为 Apache。欢迎先提 issue 讨论核心改进。合并外部核心实现前，需取得贡献者明确的、非独占的授权，允许项目以社区和商业条款再许可该贡献。贡献者保留版权；提交 PR 不自动授予该额外权利，维护者也不能假设协议已签署。

`src/**`, `rust-core/**`, `demo/**`, and listed configuration retain the Community License; opening tests and examples does not relicense the core. Discuss core improvements in an issue first. Before merging external core implementation, obtain an explicit, nonexclusive grant allowing the project to relicense the contribution under community and commercial terms. Contributors retain ownership. Opening a PR does not automatically grant those additional rights, and maintainers must not presume an agreement exists.

具体流程见 `docs/贡献许可政策.md`。组织可免费内部使用核心，但出售网关访问、收费托管或商业捆绑须按核心许可另行授权。

See `docs/贡献许可政策.md`. Organizations may use the core internally for free, but selling gateway access, paid hosting, or commercial bundling requires permission under the core license.

## 小步协作 / Small, reviewable changes

1. 先提出问题与可验证的目标，不贴敏感资料。 / Start with a problem and a verifiable goal, without sensitive material.
2. 从功能分支开始，一次 PR 做一个逻辑改变。 / Work on a feature branch, one logical change per PR.
3. 使用合成数据，按 Docker 工作流运行相关测试并报告实际结果。 / Use synthetic data, run applicable tests through the Docker workflow, and report actual results.
4. 说明第三方来源、许可和重要 AI 辅助，保留署名及修改声明。 / Disclose third-party sources, licenses, and substantial AI assistance; retain attribution and change notices.
5. 不把未运行的检查标为通过，不把 API 示例宣称为对核心的重新授权。 / Do not mark unrun checks as passed or treat API examples as relicensing the core.

## 隐私与来源 / Privacy and provenance

不得提交密钥、真实客户数据、私有产品实现或未获授权的材料。AI 辅助不证明版权归属、独创性或不侵权。贡献者必须有权授权，必要时确认雇主批准。独立插件作者保留自己的 IP，不要求上交私有适配器。

Do not submit secrets, real customer data, private product implementation, or unauthorized material. AI assistance does not establish ownership, originality, or noninfringement. Contributors must have authority to grant rights, including employer approval where necessary. Independent plugin authors retain their IP; private adapters need not be contributed.

安全问题私下联系 <jason.you1995@gmail.com>，不要公开敏感复现。普通问题可公开提交。所有参与者遵守 `CODE_OF_CONDUCT.md`。

Report security issues privately to <jason.you1995@gmail.com>, without public sensitive reproductions. Ordinary issues may be public. Follow `CODE_OF_CONDUCT.md`.
