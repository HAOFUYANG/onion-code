---
kind: design
name: 采用 Ink + React 重构终端 UI 层
source: session
category: adr
---

# 采用 Ink + React 重构终端 UI 层

_来源：9d7b66c → 53d779b 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
原有的 `src/agent/input.ts` 使用手写 raw mode 处理终端输入，缺乏光标管理、占位符及复杂交互（如命令自动补全）的原生支持，导致 UI 逻辑复杂且难以维护。

## 决策驱动
- 组件化开发效率
- 原生 UI 控件支持（光标、Placeholder）
- 交互体验升级（支持 TipTap 风格下拉菜单）

## 备选方案
- **继续使用手写 raw mode** _（已否决）_ — 优点：无额外依赖，轻量级；缺点：需自行实现光标移动、文本编辑、高亮等底层逻辑，扩展性差，难以实现复杂的 Slash 命令面板
- **迁移至 Ink + React 框架** — 优点：利用 React 组件模型管理状态，`@inkjs/ui` 提供成熟的 `TextInput` 等组件，支持 JSX 声明式 UI，便于实现 `SlashPanel` 等复杂交互；缺点：引入 React 和 Ink 依赖，增加包体积，需配置 `tsconfig.json` 支持 JSX

## 决策
弃用手写 raw mode，引入 `ink`、`react` 及 `@inkjs/ui` 作为核心渲染引擎。新建 `src/agent/ui/InputPrompt.tsx` 和 `src/agent/ui/SlashPanel.tsx` 组件，通过 `ink.render` 替换原有的 `readUserInput` 实现。保留 `fallbackPrompt` 以兼容非 TTY 环境，并确保 `src/agent/agent.ts` 等核心业务逻辑不受影响。

## 影响
终端交互能力显著增强，支持受控输入、动态命令提示面板及状态行显示。代码结构从过程式转向组件化，提升了 UI 部分的可维护性。但项目现在强依赖 React 生态，构建配置需包含 JSX 支持。