# 许可与协作边界 / Licensing and collaboration

采用开放协作区加源码可见核心的模式。已有 Apache-2.0 权利不变，核心商业规则不变。

The project combines an open collaboration area with a source-available core. Existing Apache-2.0 grants and the core's commercial model remain unchanged.

| 范围 / Area | 许可 / License | 要点 / Summary |
| --- | --- | --- |
| 文档、规范、`tests/**`、`examples/**` / Docs, specifications, tests, examples | Apache-2.0 | 可按原许可自由使用与贡献，包括商业用途 / Use and contribute under that license, including commercially |
| 网关核心、Rust 核心、demo 及列明配置 / Gateway core, Rust core, demo, listed configuration | `LicenseRef-Handoff-Community-1.0` | 个人和组织内部使用免费，网关商业化另行授权 / Free personal and organizational internal use; separate permission for gateway commercialization |
| 第三方 / Third-party material | 各自原许可 / Its original license | 不被本项目重新授权 / Not relicensed by this project |

完整路径见 `LICENSE-SCOPE.md`。根目录 `LICENSE` 是 Apache-2.0；核心英文条款见 `LICENSES/Handoff-Community-1.0.txt`。本页是说明，不扩展或限制许可原文。

See `LICENSE-SCOPE.md` for the full map. Root `LICENSE` is Apache-2.0; the English core terms are in `LICENSES/Handoff-Community-1.0.txt`. This summary does not expand or narrow those licenses.

## 免费采用 / Free adoption

个人、企业、高校、非营利组织和政府可免费开展内部评估、研发、研究、教学和生产运营，无须联系作者。内部业务收益、成本节约和正常学费本身不触发收费。允许符合许可的免费分享和社区服务。

Individuals, businesses, universities, nonprofits, and governments may use the core for internal evaluation, development, research, teaching, and production without contacting the author. Internal business benefit, savings, and ordinary tuition do not themselves trigger a fee. Sharing and community services are permitted within the license terms.

可为最终用户自己部署的内部使用收取安装、培训、配置、维护和支持费，但不得据此转售访问权或提供收费托管网关。内部使用后向客户交付普通工作成果不等于出售网关。

Providers may charge for installation, training, configuration, maintenance, and support of an end user's own internal deployment, but not use that exception to resell access or offer a paid hosted gateway. Delivering ordinary work produced with internal use is not selling the gateway.

## 商业化核心 / Commercializing the core

销售或出租网关、对访问或功能收费、提供收费托管服务、把网关嵌入或捆绑商业产品并向客户提供其功能，须先取得单独书面授权。正常教学免费，专门向学生收费出售网关访问则需授权。

Selling or renting the gateway, charging for its access or functionality, offering paid hosting, or embedding or bundling its functionality into a commercial customer offering requires a separate written license. Ordinary teaching is free; a specific paid gateway-access offering to students requires permission.

联系 Jason You: <jason.you1995@gmail.com>。咨询不等于许可；允许的免费用途可自愿购买支持，但并非使用前提。详见 `docs/商业授权.md`。

Contact Jason You at <jason.you1995@gmail.com>. An inquiry is not permission. Support for already-permitted uses is optional, not a condition of free use. See `docs/商业授权.md`.

## 独立集成与权利 / Independent integrations and rights

独立插件调用公开 API 不会仅因调用就自动成为衍生作品或作者财产。插件作者保留自己的权利；此说明不保证任何具体实现的法律分类。若实际分发、捆绑、转售网关或对其功能收费，核心许可仍适用。Apache 测试或示例导入核心不会改变核心许可。

An independent plugin does not automatically become a derivative work or the author's property merely by calling a public API. Plugin authors retain their rights; this is not a legal classification of every implementation. Actual gateway distribution, bundling, resale, or charging for gateway functionality remains subject to the core terms. Apache-licensed tests or examples do not relicense the core they import.

核心是源码可见软件，不是 OSI 开源软件；开放协作区采用 Apache-2.0。作者不取得第三方或贡献者的版权。免费使用不要求隐藏遥测、联网激活或回传内容，也不保证收入、买家、安全认证或合规结果。正式商业及贡献协议宜经法律顾问审阅。

The core is source-available, not OSI open source; the collaboration area uses Apache-2.0. The author does not acquire third-party or contributor ownership. Free use does not require hidden telemetry, online activation, or content reporting, and does not promise revenue, buyers, security certification, or compliance outcomes. Commercial and contribution agreements should receive appropriate legal review.
