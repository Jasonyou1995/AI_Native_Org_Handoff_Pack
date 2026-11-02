# 许可证范围 / License scope

根目录 `LICENSE` 保留 Apache-2.0 原文。基线为 `48a6535dc68bfb641f698a98c09ae8f008d754f2`，已有许可不撤销。本清单按原创内容划分许可，不改变第三方材料的权利。

The root `LICENSE` contains Apache-2.0. Existing grants, including those for baseline `48a6535dc68bfb641f698a98c09ae8f008d754f2`, remain intact. This map identifies licenses for original project material; it does not change third-party rights.

## 开放协作区 / Open collaboration area

以下原创内容适用 Apache-2.0：

The following original material is licensed under Apache-2.0:

- `docs/**`、`spec/**`：文档与规范 / documentation and specifications.
- `tests/**`：独立测试与合成夹具 / standalone tests and synthetic fixtures.
- `examples/**`：客户端与集成示例 / clients and integration examples.
- 基线已有内容及未明确列为例外的项目文件 / baseline material and project files not expressly excepted below.

测试或示例导入、调用网关不会把网关核心改为 Apache-2.0。不得把核心实现复制到此区域后就宣称其许可改变。混合来源材料保留原许可、署名和修改声明。

Importing or calling the gateway from tests or examples does not relicense the core. Copying core implementation into this area does not make that implementation Apache-2.0. Preserve original licenses, attribution, and change notices for mixed-source material.

## 社区许可核心 / Community-licensed core

以下基线后新增原创内容适用 `LICENSES/Handoff-Community-1.0.txt`，标识为 `LicenseRef-Handoff-Community-1.0`：

The following original additions after the baseline use `LICENSES/Handoff-Community-1.0.txt`, identified as `LicenseRef-Handoff-Community-1.0`:

- `src/**`：网关、桥接、入口 / gateway, bridge, and entry points.
- `rust-core/**`：Rust 核心、其中内嵌测试及 Cargo 配置 / Rust core, its embedded tests, and Cargo configuration.
- `demo/**`：演示界面与逻辑 / demo interface and logic.
- `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `biome.json`：项目配置的原创部分 / original project configuration.
- `Dockerfile`, `compose.yaml`, `Makefile`, `.dockerignore`, `.env.example`：构建和运行配置 / build and runtime configuration.
- `.github/workflows/**`：CI 配置 / CI configuration.

尚不存在的路径不代表已实现。锁文件中的依赖、构建缓存、工具链和第三方内容不属于作者的原创许可范围。上述核心生成的编译产物适用核心许可，其中的依赖保留原许可。

Listing a path does not assert that it exists. Dependencies named in lockfiles, build caches, toolchains, and third-party material are not the author's original licensed material. Compiled core outputs retain the core license; their dependencies keep their own licenses.

## 标记与分发 / Notices and distribution

支持注释的原创文件按所属区域使用相应文件头：

Use the appropriate header for original files that support comments:

```text
Copyright 2026 Jason You
SPDX-License-Identifier: Apache-2.0
See LICENSE and LICENSE-SCOPE.md.
```

```text
Copyright 2026 Jason You
SPDX-License-Identifier: LicenseRef-Handoff-Community-1.0
See LICENSES/Handoff-Community-1.0.txt and LICENSE-SCOPE.md.
```

贡献者保留自身署名，不应把他们的版权改写为作者所有。JSON 等无注释格式由本清单标明。根目录 `NOTICE` 的 Apache 声明不对核心授予 Apache 许可。分发包和镜像必须携带本清单及适用 LICENSE、NOTICE 和第三方通知。

Contributors retain their own attribution; do not replace their copyrights with the founder's. This map covers formats such as JSON without comments. The Apache statement in root `NOTICE` does not grant Apache rights to the core. Packages and images must include this map and applicable licenses, notices, and third-party attributions.
