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

## 安装

### 前置条件

- DeepSeek Harness（`dsh`）已安装并运行
- Python 3.10+（Windows 建议 3.11/3.12/3.13，见 [Windows 注意](#windows-注意)）

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

## Windows 注意

Headroom 官方尚未发布 Windows 预编译 wheel（见
[headroom#636](https://github.com/headroomlabs-ai/headroom/issues/636)），
`pip install` 时 Rust 扩展需从源码构建，需要：

- **Visual Studio Build Tools**（含 "Desktop development with C++"，提供 `link.exe`）
- **Rust**（`rustup`，`stable-x86_64-pc-windows-msvc` 工具链）

若你的机器已有可用的 Python 环境（本插件会优先复用），可跳过构建。
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
