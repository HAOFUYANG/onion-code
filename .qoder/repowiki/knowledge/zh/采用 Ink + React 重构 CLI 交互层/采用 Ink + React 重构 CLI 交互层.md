---
kind: design
name: 采用 Ink + React 重构 CLI 交互层
source: session
category: adr
---

# 采用 Ink + React 重构 CLI 交互层

_来源：2635719 → dea62aa 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
原有的 `src/agent/input.ts` 使用手写 raw mode 处理终端输入，缺乏光标控制、placeholder 等现代交互特性，且代码维护成本高。为了提升用户体验并简化 UI 逻辑，需要引入成熟的终端 UI 框架。

## 决策驱动
- 交互体验增强（光标、placeholder、动态渲染）
- 开发效率（利用现有组件库而非手写底层逻辑）
- 架构解耦（将 UI 渲染与 Agent 核心逻辑分离）

## 备选方案
- **继续使用手写 raw mode** _（已否决）_ — 优点：无额外依赖，体积最小；缺点：实现复杂交互（如 Slash 命令下拉菜单）极其困难，缺乏标准组件支持，维护成本高
- **采用 Ink + React 框架** — 优点：基于 React 组件化模型，拥有 `@inkjs/ui` 官方组件库（如 TextInput），支持声明式 UI，易于扩展复杂交互（如 SlashPanel）；缺点：引入 React 和 Ink 依赖，增加包体积，需配置 JSX 编译支持

## 决策
选择 Ink + React 作为新的 CLI UI 基础架构。具体实施包括：安装 `ink`, `react`, `@inkjs/ui`；新建 `src/agent/ui/InputPrompt.tsx` 和 `SlashPanel.tsx` 组件；重写 `src/agent/input.ts` 中的 `readUserInput` 以调用 `ink.render`；同时更新 `tsconfig.json` 启用 `jsx: react-jsx`。Agent 核心逻辑 (`agent.ts`, `cli.ts`) 保持不变，仅通过接口与新的 UI 层交互。

## 影响
CLI 交互能力显著提升，支持了类似 TipTap 风格的 Slash 命令下拉菜单和状态行显示。代码结构上，UI 逻辑从过程式 raw mode 迁移至声明式 React 组件，提高了可维护性。但项目现在依赖 React 运行时，且构建流程需支持 JSX 转换。非 TTY 环境仍需保留 `fallbackPrompt` 兼容处理。