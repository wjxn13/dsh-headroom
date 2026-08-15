# dsh-headroom

DeepSeek Harness 的 Headroom 上下文压缩代理集成插件：一键检测、安装、启动
[Headroom](https://github.com/headroomlabs-ai/headroom) 压缩代理，并自动接入 DeepSeek
线路（OpenAI 协议），在设置页提供状态面板与切换控件。

> **重要声明**：本插件是 [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom)
> （Apache License 2.0）的**集成与封装**，Headroom 压缩引擎本身由 Headroom 项目提供，
> 版权归其作者所有。本插件不包含、也不修改 Headroom 的压缩算法，仅负责：
> 环境检测、依赖安装、进程管理、DeepSeek 兼容预设与线路切换 UI。
> 详见 [NOTICE](./NOTICE) 与 [LICENSE](./LICENSE)。

## 功能

- **一键启用压缩线路**：设置页点按钮，把 DSH 的 `llm-deepseek.baseURL` 指向本地 Headroom 代理
- **自动环境管理**：检测 Python → 自动建 venv → 安装 `headroom-ai[proxy]`（轻量，无 torch）
- **进程守护**：自动启动 headroom proxy、`/livez` 健康检查、崩溃提示
- **兼容预设**：固化 Windows workaround（`HEADROOM_DETECT_BACKEND=python`、
  `HEADROOM_TOOL_SEARCH=off`）与 DeepSeek 双协议路由
- **一键切回直连**：任何时刻可切回 `api.deepseek.com`，无锁死风险
- **实时统计**：设置页显示花费/节省 token、缓存命中率（每 10 秒刷新）

## 实测成果

> 以下数据来自本机真实使用（DeepSeek V4-Flash，DSH 大上下文会话），2026-08-15 统计：

| 指标 | 实测值 | 说明 |
|---|---|---|
| 累计压缩节省 | **1,256,265 token** | Headroom 累计压缩掉的 token（跨 1,533 次请求） |
| 累计输入 | 413M token | 压缩后实际发送量 |
| 缓存命中率 | **99.9%** | 前缀缓存命中（DeepSeek 官方机制，Headroom 不破坏它） |
| 单请求典型节省 | 4-71 token / 请求 | 工具 schema 压缩为主（大上下文会话） |

### 能省多少？（诚实预期）

Headroom 官方宣称可省 60-95% token（JSON 数据）或 15-20%（编码 agent），但**实际节省取决于场景**：

- **JSON/结构化数据密集**（工具输出、API 响应）：压缩空间大，接近官方宣称的高端
- **大上下文 coding 会话**（DSH 这类 1M 上下文）：工具 schema 已压缩、历史已缓存，**新增节省约 0.1-0.3%**——但配合 DeepSeek 前缀缓存（99.9% 命中），每次请求的新内容成本极低（~100 token）
- **省钱大头是缓存**：Headroom 的核心价值是**不破坏** DeepSeek 的缓存（改写确定性），让 99.9% 输入走折扣价；压缩是锦上添花

> 金额换算建议以 DeepSeek 官方账单为准（价格峰谷变动频繁，插件不估算金额，避免误导）。

## 安装

### 前置条件

- DeepSeek Harness（`dsh`）已安装并运行
- Python 3.10+（Windows 3.10-3.13 均可，Headroom ≥0.35 提供预编译 wheel，无需编译工具链）

### 安装插件

```bash
# 克隆仓库（或下载 release 包）
git clone https://github.com/wjxn13/dsh-headroom.git

# 用 dsh 的插件命令安装（npm 包形式）
cd ~/.dsh/profiles/web
dsh plugin add file:../dsh-headroom  # 或本地路径
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 的顶层数组加：

```yaml
- insert:
    - id: dsh-headroom
      name: '@dsh-external/dsh-headroom'
```

重启 `dsh web`，打开 **设置 → 线路切换**。

## 使用

打开 DSH Web → 设置 → **线路切换** 页签：

1. **首次使用**：点「安装 Headroom 引擎」（自动建 venv + pip install，约 50MB）
2. **启动**：点「启动压缩线路」（自动拉起代理并写入 baseURL）
3. **切换**：随时点「切回直连」恢复默认线路

> ⏳ **注意**：启动压缩线路后，**首次对话可能需要等待约 1 分钟**——这是 Headroom
> 冷启动（首次加载 tokenizer / 模型组件），之后请求恢复正常（几秒内）。

## Windows

Headroom **0.35.0 起提供 Windows 预编译 wheel**（`headroom_ai-*-win_amd64.whl`，
Python 3.10+，见 [headroom#636](https://github.com/headroomlabs-ai/headroom/issues/636)），
`pip install headroom-ai[proxy]` 在 Windows 上直接安装，**无需 Rust 或 MSVC 工具链**。

详细的 Headroom 安装说明见[官方文档](https://github.com/headroomlabs-ai/headroom/blob/main/docs/content/docs/installation.mdx)。

## 兼容性

| 协议 | 线路 | 状态 |
|---|---|---|
| OpenAI（DSH 默认） | DeepSeek 直连 / Headroom 压缩 | ✅ 已实测 |
| Anthropic（Claude Code） | 经 Headroom 压缩 | ✅ 参考 README（上游支持） |

## 开发

```bash
pnpm install
pnpm run build    # 构建 client bundle + host lib
```

## 致谢与许可

- 压缩引擎：[headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom)（Apache 2.0）
- 本插件：Apache License 2.0（见 [LICENSE](./LICENSE)），NOTICE 见 [NOTICE](./NOTICE)
