## 1. 核心体系与工具
该项目采用 **Node.js (ESM)** 环境，使用 **pnpm** 作为主要的包管理器。依赖管理呈现出“双轨制”特征：
- **代码依赖**：通过 `package.json` 声明，由 `pnpm-lock.yaml` 锁定版本。
- **技能（Skills）依赖**：通过自定义的 `skills-lock.json` 管理来自 GitHub 的智能体技能模块（如 PDF 处理、UI 组件）。

## 2. 关键文件说明
- **`package.json`**：定义了项目元数据、脚本及第三方库。核心依赖包括 `@langchain/*`（智能体逻辑）、`ink`（终端 UI）、`react` 以及 `better-sqlite3`（持久化存储）。
- **`pnpm-lock.yaml`**：采用 lockfileVersion '9.0'，确保了跨环境安装的确定性。配置中启用了 `autoInstallPeers`。
- **`skills-lock.json`**：记录了从外部仓库（如 `anthropics/skills`）拉取的 Skill 版本，通过 `computedHash` 保证内容完整性。

## 3. 架构约定与规则
- **原生模块构建限制**：在 `package.json` 的 `pnpm` 字段中明确配置了 `onlyBuiltDependencies: ["better-sqlite3"]`。这意味着 pnpm 默认会忽略其他包的 `preinstall/postinstall` 脚本，仅允许 SQLite 绑定进行编译，以提升安装速度并增强安全性。
- **模块化技能加载**：项目不将所有功能硬编码在 `node_modules` 中，而是通过 `skills-lock.json` 动态引用外部技能。这种模式要求开发者在更新技能时，需关注 `src/agent/skills/` 目录下的同步状态。
- **开发环境适配**：使用 `tsx` 进行 TypeScript 的即时运行（`dev` 脚本），生产环境则通过 `tsc` 编译至 `dist/` 目录。