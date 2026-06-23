## 1. 系统概述

OnionCode 采用**双层配置架构**来管理运行时配置：
- **敏感/环境配置层**：通过 `.env` 文件结合 `dotenv` 库加载，用于存储 API Key、模型名称等敏感或环境相关的变量。
- **应用/功能配置层**：通过项目根目录下的 `.data/config.json` 文件管理，用于存储 Python 运行环境、pip 镜像源等功能性配置，支持交互式 CLI 修改并持久化。

这种分层设计将"环境依赖"与"用户偏好/功能开关"解耦，既保证了敏感信息的安全性（不进入版本控制），又提供了友好的用户配置体验。

## 2. 关键文件与职责

| 文件路径 | 职责说明 |
|---|---|
| `.env` | 存储敏感环境变量，如 `OPENAI_API_KEY`、`OPENAI_MODEL`、`TAVILY_API_KEY`。该文件被 `.gitignore` 排除，不提交到版本库。 |
| `src/agent/config.ts` | 核心配置模块。定义了 `AppConfig` 接口及默认值 `DEFAULT_CONFIG`，提供 `loadConfig()`、`saveConfig()` 和 `openConfigDialog()` 函数，负责 `.data/config.json` 的读写与合并逻辑。 |
| `src/agent/agent.ts` | Agent 初始化入口。在此处调用 `dotenv.config()` 加载 `.env` 文件，并从 `process.env` 读取模型配置初始化 `ChatOpenAI` 实例。 |
| `.data/config.json` | 运行时生成的应用配置文件。存储 Python 虚拟环境路径、自动安装开关、pip 镜像源地址等结构化配置。 |
| `skills-lock.json` | 技能锁文件。记录从 GitHub 拉取的 Skill 来源、引用 commit 及哈希校验值，确保技能版本的可复现性。 |
| `package.json` | 项目元数据与依赖管理。声明了 `dotenv` 作为生产依赖，以及 `tsx`、`typescript` 等开发工具链。 |

## 3. 架构与约定

### 3.1 环境变量层 (`.env`)
- **加载机制**：在 `src/agent/agent.ts` 中，使用 `path.resolve(__dirname, "../../.env")` 显式指定 `.env` 文件路径，确保无论从哪里启动 CLI，都能正确找到项目根目录下的环境变量文件。
- **使用模式**：通过 `process.env.OPENAI_MODEL ?? "deepseek-v4-flash"` 提供默认值，防止因环境变量缺失导致程序崩溃。
- **安全约束**：`.env` 包含真实的 API Key，严禁提交至 Git。代码中通过 `dotenv` 仅在进程启动初期加载一次。

### 3.2 应用配置层 (`.data/config.json`)
- **默认值合并策略**：`src/agent/config.ts` 中的 `mergeConfig` 函数实现了深度合并逻辑。当 `config.json` 缺失或部分字段为空时，自动回退到 `DEFAULT_CONFIG`。这保证了新版本的配置项能无缝兼容旧用户的配置文件。
- **持久化路径**：所有应用配置统一存放在 `.data/` 目录下，与 SQLite 会话数据库 (`checkpointer.db`) 和 Python 虚拟环境 (`python-venv`) 保持物理位置的一致性，便于用户进行整体备份或清理。
- **交互式配置**：通过 `openConfigDialog()` 函数集成 `inquirer` 库，为用户提供基于终端的交互式配置向导。用户无需手动编辑 JSON 文件，即可修改 pip 镜像源或触发 Python 环境初始化。

### 3.3 技能配置 (`skills-lock.json`)
- **版本锁定**：采用类似 `pnpm-lock.yaml` 的机制，记录每个 Skill 的 `computedHash`。系统在加载 Skill 时会校验哈希值，防止远程 Skill 被篡改或意外更新导致的行为不一致。

## 4. 开发者规则与最佳实践

1. **敏感信息隔离**：任何 API Key、Token 或密码类配置必须放入 `.env` 并通过 `process.env` 访问，**禁止**硬编码在 TypeScript 源码中或存入 `.data/config.json`。
2. **配置默认值优先**：在 `config.ts` 中为所有新增配置项定义合理的 `DEFAULT_CONFIG`。读取配置时应始终使用 `loadConfig()` 返回的合并后对象，避免直接解析 JSON 导致的字段缺失错误。
3. **环境路径相对化**：加载 `.env` 或 `config.json` 时，应使用 `path.resolve(__dirname, ...)` 或基于 `process.cwd()` 的路径，确保在开发模式 (`tsx`) 和生产模式 (`node dist/...`) 下路径解析均正确。
4. **配置变更即时生效**：对于通过 `openConfigDialog` 修改的配置，应在保存后立即触发相应的初始化逻辑（如 `ensurePythonEnvironment`），并在 UI 上给予明确的成功/失败反馈。
5. **类型安全**：所有配置结构必须定义对应的 TypeScript `interface`（如 `AppConfig`, `PythonConfig`），并在 `loadConfig` 中进行必要的类型守卫或容错处理。