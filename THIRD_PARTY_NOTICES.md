# 第三方许可说明

`LICENSES/Handoff-Community-1.0.txt` 只涵盖明确按该许可发布的原创内容，不覆盖第三方依赖、运行时、基础镜像或已按 Apache-2.0 发布的材料。

发布者必须根据实际锁文件、构建产物和容器镜像补齐依赖清单，保留每项依赖要求的许可与通知。不能把本文件当作已完成的 SBOM 或许可审计，也不能因为某依赖未列出就推定其适用社区许可。

若复制或改编旧 handoff 内容，应在相应文件标明原来源和修改，随分发保留根目录 Apache-2.0 LICENSE 与适用 NOTICE。作者不取得这些依赖、镜像或第三方作品的所有权。

## 当前直接依赖记录

以下 npm 版本与许可标识来自本仓库当前 `package-lock.json`，仅记录直接依赖，不代表全部传递依赖已经审计。完整许可证文本仍须随实际分发产物保留。

| 包 | 锁定版本 | 锁文件许可标识 |
| --- | --- | --- |
| `@hono/node-server` | 2.1.5 | MIT |
| `hono` | 4.13.16 | MIT |
| `zod` | 4.6.7 | MIT |
| `@biomejs/biome` | 2.6.4 | MIT OR Apache-2.0 |
| `@types/node` | 24.19.2 | MIT |
| `tsx` | 4.23.15 | MIT |
| `typescript` | 7.0.2 | Apache-2.0 |
| `vitest` | 5.0.5 | MIT |

## Rust 锁定依赖

`rust-core/Cargo.lock` 已生成，以下版本从实际锁文件读取。锁文件不包含许可证文本，本清单仅核对名称与版本，不宣称已完成各 crate 许可、传递依赖法律兼容性或二进制通知审计。发布构建须保留各 crate 的原许可证及要求的通知。

| crate | 锁定版本 |
| --- | --- |
| `aho-corasick` | 1.1.5 |
| `itoa` | 1.0.18 |
| `memchr` | 2.8.3 |
| `proc-macro2` | 1.0.107 |
| `quote` | 1.0.47 |
| `regex` | 1.12.2 |
| `regex-automata` | 0.4.18 |
| `regex-syntax` | 0.8.11 |
| `ryu` | 1.0.23 |
| `serde` | 1.0.228 |
| `serde_core` | 1.0.228 |
| `serde_derive` | 1.0.228 |
| `serde_json` | 1.0.145 |
| `syn` | 2.0.119 |
| `unicode-ident` | 1.0.27 |

Node、Rust 工具链和容器基础镜像保留各自许可。清单随锁文件更新，实际分发仍须检查完整通知，不能以本清单替代原许可证。
