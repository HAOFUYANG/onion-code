## 1. 构建体系概览
项目采用 **TypeScript + Node.js** 技术栈，使用 **pnpm** 作为包管理器，**tsc** (TypeScript Compiler) 进行编译构建。

- **开发模式**: 使用 `tsx` 直接运行 TypeScript 源码，支持热重载和快速迭代 (`npm run dev`)。
- **生产构建**: 通过 `tsc` 将 `src` 目录下的代码编译至 `dist` 目录，并手动拷贝非代码资源（如 skills 文件夹）到输出目录 (`npm run build`)。
- **入口文件**: `bin/onionCode.js` 作为 CLI 入口，通过 Shebang (`#!/usr/bin/env node`) 触发，动态加载编译后的 `dist/agent/cli.js`。

## 2. 关键配置文件
- **package.json**: 定义了脚本命令、依赖项及二进制入口。特别配置了 `pnpm.onlyBuiltDependencies` 以处理 `better-sqlite3` 的原生模块编译。
- **tsconfig.json**: 设定了编译目标为 `ES2022`，模块系统为 `nodenext`，启用 `react-jsx` 支持（用于 Ink UI），并开启严格模式。
- **pnpm-lock.yaml**: 锁定依赖版本，确保环境一致性。

## 3. 测试与质量保障
- **测试框架**: 使用 **Vitest** 进行单元测试 (`npm run test`)。
- **测试范围**: 主要针对 `src/agent/tools` 下的工具函数（如 `exec.ts`, `read_file.ts` 等）进行了覆盖。

## 4. 开发者规范
- **资源管理**: 由于 `tsc` 仅编译 TS/JS 文件，新增静态资源（如 Markdown 技能描述、Python 脚本）时，需确保在 `build` 脚本中增加相应的拷贝逻辑。
- **原生依赖**: 项目依赖 `better-sqlite3`，在不同平台（Windows/macOS/Linux）安装或构建时需确保具备对应的 C++ 编译环境。
- **类型安全**: `tsconfig.json` 开启了 `strict: true`，开发时应遵循严格的类型约束，避免使用 `any`。