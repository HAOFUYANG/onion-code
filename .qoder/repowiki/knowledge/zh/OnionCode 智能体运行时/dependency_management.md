该项目采用 **pnpm** 作为主要的 JavaScript/TypeScript 依赖管理工具，并辅以 **skills-lock.json** 管理 AI 技能（Skills）依赖，同时在运行时通过 **python_env.ts** 动态管理 Python 虚拟环境及第三方库。

### 1. Node.js 依赖管理 (pnpm)
- **包管理器**: 使用 `pnpm`，通过 `package.json` 声明依赖，`pnpm-lock.yaml` 锁定版本（lockfileVersion: '9.0'）。
- **依赖分类**:
  - **核心框架**: `vue`, `@vue-tui/runtime` 用于构建 TUI 界面。
  - **AI 引擎**: `langchain`, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai` 等构成 Agent 核心。
  - **工具库**: `commander` (CLI 解析), `inquirer` (交互), `better-sqlite3` (持久化), `zod` (校验)。
- **构建与开发**: 使用 `vite` 进行构建，`vitest` 进行测试，`tsx` 用于直接运行 TypeScript 源码。
- **原生模块处理**: 在 `package.json` 中配置 `pnpm.onlyBuiltDependencies`，明确允许 `better-sqlite3` 和 `@rolldown/binding-darwin-arm64` 进行原生构建，确保跨平台兼容性。

### 2. AI 技能依赖 (skills-lock.json)
- **技能锁文件**: `skills-lock.json` 用于管理外部 AI 技能（如 `anthropics/skills` 中的 `pdf` 技能）。
- **版本控制**: 通过 `ref` (如 `main`) 和 `computedHash` 确保技能内容的完整性和来源可信度，类似于 Git submodule 或 lockfile 的机制。

### 3. Python 运行时依赖管理
- **动态环境隔离**: `src/agent/python_env.ts` 实现了独立的 Python 依赖管理体系。
  - **虚拟环境**: 自动在项目目录下创建和管理 `venv` 虚拟环境，避免污染全局 Python 环境。
  - **按需安装**: 通过 `detectRequiredPackages` 静态分析代码中的 `import` 语句（如 `pandas`, `numpy`, `openpyxl`），并在执行前通过 `pip` 自动安装缺失的依赖。
  - **配置化**: 支持通过 `config.python.pip` 配置私有镜像源（`indexUrl`）和信任主机（`trustedHost`），适应内网或特定网络环境。

### 4. 开发者规范
- **新增 JS 依赖**: 必须使用 `pnpm add <package>` 安装，并提交 `pnpm-lock.yaml` 的变更。
- **Python 依赖**: 尽量避免在全局安装 Python 库。若 Agent 需要新的 Python 能力，应在代码中通过 `import` 引入，系统会自动处理安装；或在配置中开启 `autoInstall`。
- **技能更新**: 修改 `skills-lock.json` 需谨慎，确保 `computedHash` 与远程技能内容一致，防止技能加载失败。