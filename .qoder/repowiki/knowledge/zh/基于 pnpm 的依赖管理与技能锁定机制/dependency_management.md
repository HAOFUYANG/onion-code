## 1. 依赖管理系统
本项目采用 **pnpm** 作为核心包管理器，通过 `package.json` 声明依赖，并使用 `pnpm-lock.yaml` (lockfileVersion: '9.0') 进行版本锁定。这种选择确保了依赖安装的确定性、更快的安装速度以及高效的磁盘空间利用（通过硬链接和符号链接）。

### 核心配置文件
- **`package.json`**: 定义了项目的元数据、脚本（如 `dev`, `build`, `test`）以及生产/开发依赖。项目类型为 `"module"`，入口点为 `dist/index.js`。
- **`pnpm-lock.yaml`**: 记录了所有直接和间接依赖的精确版本及完整性哈希，确保在不同环境中构建的一致性。
- **`tsconfig.json`**: 配置了 TypeScript 编译选项，模块系统采用 `nodenext`，与 ESM 环境保持一致。

## 2. 依赖分类与架构
依赖被清晰地划分为运行时依赖 (`dependencies`) 和开发依赖 (`devDependencies`)：

### 运行时依赖 (Runtime)
- **AI 智能体框架**: `@langchain/core`, `@langchain/langgraph`, `@langchain/openai` 等构成了智能体的核心逻辑。
- **终端 UI (TUI)**: 使用 `ink` 和 `@assistant-ui/react-ink` 结合 `react` 实现响应式命令行界面。
- **工具库**: `commander` (CLI 参数解析), `chalk` (终端样式), `better-sqlite3` (本地会话持久化), `zod` (数据校验)。

### 开发依赖 (Dev)
- **构建与运行**: `typescript`, `tsx` (用于开发环境直接运行 TS), `ts-node`。
- **测试**: `vitest` 作为测试框架。
- **类型定义**: `@types/node`, `@types/react` 等。

### 特殊配置
在 `package.json` 中配置了 `pnpm.onlyBuiltDependencies`，仅允许 `better-sqlite3` 执行原生构建脚本。这是一种安全最佳实践，防止了其他依赖在安装时执行不可信的预/后安装脚本。

## 3. 技能（Skills）依赖管理
项目引入了一种特殊的“技能”依赖管理机制，通过 **`skills-lock.json`** 文件实现：
- **来源**: 技能直接从 GitHub 仓库（如 `assistant-ui/skills`, `anthropics/skills`）拉取。
- **版本控制**: 通过 `computedHash` 对技能内容（`SKILL.md` 等）进行哈希校验，确保技能的完整性和一致性，类似于依赖锁文件。
- **存储**: 技能文件实际存储在 `src/agent/skills/` 目录下，并在构建时通过 `cp -r` 复制到 `dist` 目录。

## 4. 开发者规范
- **添加依赖**: 必须使用 `pnpm add <package>` 或 `pnpm add -D <package>`，严禁手动修改 `package.json` 而不更新锁文件。
- **构建流程**: 构建命令 `npm run build` 不仅编译 TypeScript，还显式处理了非代码资源（Skills 文件夹）的拷贝，新增技能或修改技能结构时需同步更新构建脚本。
- **安全性**: 保持 `onlyBuiltDependencies` 的最小化原则，除非必要，不授权其他依赖执行构建脚本。