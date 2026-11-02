# 本地 Rust 检测核心

TypeScript 负责 API、策略、批准、随机占位符、请求作用域映射及回填。Rust 二进制负责原文上的确定性匹配、重叠区间合并和容量检查。每次检查通过本机 stdin/stdout 运行一次，不启动网络监听或持久 sidecar。

```sh
cargo test --locked --manifest-path rust-core/Cargo.toml
cargo clippy --locked --manifest-path rust-core/Cargo.toml --all-targets -- -D warnings
cargo build --release --locked --manifest-path rust-core/Cargo.toml
```

验证工具链为 Rust 1.99.1。依赖精确版本与 Cargo.lock 一并提交。默认二进制路径为项目工作目录下 `rust-core/target/release/privacy-scanner`，可用 `PRIVACY_SCANNER_BIN` 指定管理员控制的路径。缺失、超时或无效响应会失败关闭，不自动降级。Docker 构建会编译并复制二进制，无需用户手动安装 Rust。

协议请求为 `{ "text": "...", "terms": [] }`，响应仅为版本、UTF-16 区间、类别和阻止标志，不包含原文或映射。区间可以直接用于 TypeScript `slice`，桥接器还会校验边界、排序、长度和类别。错误输出仅含固定错误码。

上限：原文 65,536 UTF-8 字节、100 个组织词且每词最多 100 个 Unicode 字符、4,096 个原始匹配。JSON 传输读取上限 524,288 字节。桥接器另设 5 秒子进程时限及输出容量限制。所有模式在原文匹配后统一合并，因此替换顺序不能产生嵌套占位符。

固定有界模式使用 Rust regex，不接受管理员提供的正则表达式，组织词先转义。词表数量有上限，扫描工作随文本长度有界增长，匹配区间排序最多涉及 4,096 项。私钥起始标志将整个剩余文本保守遮盖并阻止外发。电话号码检测有意偏向多报。格式检测并不覆盖所有秘密或个人信息，不能代替企业的数据分类与人工审查。每次启动进程及编译模式有固定开销，不宣称相较 TypeScript 更快。
