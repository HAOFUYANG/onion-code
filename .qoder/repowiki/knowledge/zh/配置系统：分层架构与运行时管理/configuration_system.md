洋葱代码智能体平台采用**分层配置策略**，将敏感凭证、应用级持久化配置以及动态环境管理分离，确保安全性与灵活性。

### 1. 配置层级与来源
- **环境变量层 (Environment Variables)**：通过 `.env` 文件加载敏感信息（如 `OPENAI_API_KEY`, `TAVILY_API_KEY`）。在 `src/agent/agent.ts` 中使用 `dotenv` 库在项目根目录显式加载。模型名称和 API Key 直接从 `process.env` 读取。
- **应用配置层 (Application Config)**：存储在 `.data/config.json` 中。由 `src/agent/config.ts` 管理，负责 Python 运行环境的路径、自动安装开关及 pip 镜像源设置。该层支持默认值合并（`DEFAULT_CONFIG`）与持久化保存。
- **会话状态层 (Session State)**：利用 SQLite (`checkpointer.db`) 存储 LangGraph 的对话历史与会话状态，路径固定在 `.data/` 目录下。

### 2. 核心逻辑实现
- **配置加载器 (`config.ts`)**：提供 `loadConfig()` 和 `saveConfig()` 方法。采用深度合并策略，确保局部修改不会覆盖其他配置项。配置文件路径通过 `getConfigPath()` 动态解析。
- **环境自适应 (`python_env.ts`)**：根据应用配置自动探测系统 Python 版本，并在 `.data/python-venv` 下创建隔离虚拟环境。它会根据代码中的 `import` 语句动态检测并安装缺失的 Python 包（如 `pandas`, `numpy`）。
- **交互式配置面板 (`ConfigPanel.tsx`)**：基于 Ink 构建的终端 UI，允许用户在不编辑 JSON 文件的情况下，通过向导式界面修改 Python 环境参数。

### 3. 开发者规范
- **敏感信息管理**：严禁在代码中硬编码 API Key。所有凭证必须通过 `.env` 注入，并在 `package.json` 依赖中保留 `dotenv`。
- **配置扩展**：新增应用配置项时，必须在 `AppConfig` 接口中定义类型，并在 `DEFAULT_CONFIG` 中提供默认值，同时在 `mergeConfig` 中处理合并逻辑。
- **路径约定**：所有持久化数据（数据库、虚拟环境、配置文件）统一收敛至项目根目录下的 `.data/` 文件夹，保持工作区整洁。