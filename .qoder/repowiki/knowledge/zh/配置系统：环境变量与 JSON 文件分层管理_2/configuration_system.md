## 1. 核心系统与工具
该项目采用**双层配置策略**，结合了环境变量（Environment Variables）和自定义 JSON 配置文件：
- **敏感信息与环境变量**：使用 `dotenv` 库加载根目录下的 `.env` 文件。主要用于存储 API Key（如 `OPENAI_API_KEY`, `TAVILY_API_KEY`）和模型名称等敏感或易变的环境参数。
- **应用运行时配置**：通过 `src/agent/config.ts` 实现了一套基于 `.data/config.json` 的持久化配置系统。该系统支持默认值、JSON 文件读取以及交互式 CLI 修改（基于 `inquirer`），用于管理 Python 运行环境路径、pip 镜像源等复杂运行时设置。

## 2. 关键文件与逻辑
- **`.env`**：存储明文环境变量，作为 LLM 提供商和网络工具的认证凭据来源。
- **`src/agent/config.ts`**：配置系统的核心模块。定义了 `AppConfig` 接口，提供了 `loadConfig()`、`saveConfig()` 以及 `openConfigDialog()`（交互式配置向导）。
- **`src/agent/agent.ts`**：Agent 初始化入口。在此处调用 `dotenv.config()` 显式指定从项目根目录加载环境变量，并实例化 `ChatOpenAI` 模型。
- **`vite.config.ts`**：在构建阶段将 `dotenv` 等依赖标记为 `external`，确保在 Node.js 运行时能正确读取本地文件系统上的 `.env` 文件。

## 3. 架构设计与约定
- **配置分层**：
  - **L1 环境变量层**：处理跨环境的差异（如开发/生产）和机密信息。
  - **L2 用户偏好层**：处理用户对工具行为的定制（如 Python 虚拟环境位置、是否自动安装依赖）。
- **持久化机制**：应用配置统一存放在 `.data/` 目录下（与 SQLite 会话数据库同目录），通过 `fs` 模块进行读写。如果配置文件不存在，系统会自动回退到 `DEFAULT_CONFIG`。
- **交互式管理**：为了降低 CLI 工具的使用门槛，系统内置了配置中心对话框，允许用户在不直接编辑 JSON 文件的情况下完成环境初始化和镜像源切换。

## 4. 开发者规范
- **新增敏感配置**：应添加到 `.env` 文件中，并通过 `process.env.VAR_NAME` 在代码中访问。注意在 `.gitignore` 中排除 `.env` 以防止密钥泄露。
- **新增功能开关或路径配置**：应在 `src/agent/config.ts` 中扩展 `AppConfig` 接口，并更新 `DEFAULT_CONFIG` 和 `mergeConfig` 逻辑以支持向后兼容。
- **配置加载时机**：环境变量在 `agent.ts` 模块加载时立即执行；JSON 配置则在需要时（如执行 Python 脚本前）通过 `loadConfig()` 动态获取。
