## 1. 核心构建体系
项目采用 **Node.js + TypeScript** 技术栈，使用 **pnpm** 作为包管理器，**TypeScript Compiler (tsc)** 进行编译构建。

- **包管理**: `pnpm` (通过 `pnpm-lock.yaml` 锁定依赖版本)。
- **编译器**: `typescript` (v6.0.3)，配置在 `tsconfig.json` 中。
- **运行时支持**: 开发环境使用 `tsx` 直接运行 TS 文件，生产环境运行编译后的 JS。

## 2. 关键脚本与流程
在 `package.json` 中定义了以下核心工作流：

- **开发模式 (`dev`)**: `tsx src/agent/cli.ts`
  - 利用 `tsx` 的即时编译能力启动 CLI，支持热重载或快速迭代。
- **生产构建 (`build`)**: `tsc && mkdir -p dist/agent/skills && cp -r src/agent/skills/* dist/agent/skills/`
  - **步骤 1**: 执行 `tsc` 将 `src` 目录下的 TypeScript 代码编译至 `dist` 目录。
  - **步骤 2**: 手动复制 `skills` 资源文件夹。由于 `tsc` 默认只处理 `.ts/.tsx` 文件，非代码资源（如 Markdown 技能描述、Python 脚本等）需要通过 `cp` 命令显式迁移到输出目录，确保运行时能正确加载技能生态。
- **测试 (`test`)**: `vitest run`
  - 使用 `Vitest` 框架运行单元测试。

## 3. 入口点设计
- **CLI 入口**: `bin/onionCode.js`
  - 这是一个标准的 Node.js shebang 脚本，通过 `import("../dist/agent/cli.js")` 动态导入编译后的主逻辑。这种设计使得包可以通过 `npm link` 或全局安装后直接在终端以 `onionCode` 命令调用。

## 4. 开发者规范
- **资源文件处理**: 如果在 `src` 中新增了非 TS 文件（如配置文件、脚本、Markdown），必须检查 `build` 脚本是否已包含相应的复制逻辑，否则这些文件在生产构建后将丢失。
- **类型检查**: `tsconfig.json` 开启了 `strict: true`，开发时应遵循严格的类型约束。
- **模块系统**: 采用 `nodenext` 模块解析策略，确保 ESM (ECMAScript Modules) 的兼容性。