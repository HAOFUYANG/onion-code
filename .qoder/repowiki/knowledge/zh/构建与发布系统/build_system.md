该项目采用基于 **Vite** 和 **pnpm** 的现代化 Node.js 构建体系，结合 **TypeScript** 进行类型检查与编译，并使用 **Vitest** 执行单元测试。

### 1. 核心工具链
- **包管理器**: `pnpm` (通过 `pnpm-lock.yaml` 锁定依赖版本)。
- **构建工具**: `Vite` (配置于 `vite.config.ts`)，用于将 TypeScript/Vue 源码打包为 Node.js 可执行的 ESM 格式。
- **编译器**: `TypeScript` (`tsc`)，配合 `vue-tsc` 进行 Vue 组件的类型检查。
- **测试框架**: `Vitest`，用于运行位于 `src/agent/tools/` 等目录下的 `.test.ts` 文件。

### 2. 构建流程与约定
- **开发模式**: 使用 `concurrently` 并行运行 `vite build --watch` (监听源码变化) 和 `node --watch` (监听构建产物变化)，实现热更新开发体验。
- **生产构建**: 
  - 执行 `vite build` 将 `src/ui/main.ts` 打包至 `dist/` 目录。
  - **资源同步**: 构建脚本包含一个手动步骤，将 `src/agent/skills` 目录完整复制到 `dist/agent/skills`，确保 Agent 技能文件在运行时可用。
  - **外部依赖处理**: `vite.config.ts` 中明确配置了 `external` 选项，将 `langchain`、`better-sqlite3` 等重型依赖排除在 bundle 之外，保持产物轻量并依赖本地 `node_modules`。
- **入口点**: `bin/onionCode.js` 作为 CLI 入口，通过 Shebang 调用 `dist/ui/main.js`。

### 3. 开发者指南
- **安装依赖**: `pnpm install`
- **启动开发环境**: `pnpm dev:start`
- **执行测试**: `pnpm test`
- **打包发布**: `pnpm build` (注意：目前未配置自动化发布流程，需手动处理 `dist` 目录的分发)。